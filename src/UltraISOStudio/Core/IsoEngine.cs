using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace UltraISOStudio.Core
{
    /// <summary>
    /// Full ISO 9660 + Joliet + UDF Bridge + El Torito Bootable image reader & writer.
    /// Supports reading and building standard ISO images, long filenames (Joliet UCS-2),
    /// hidden/system attributes, and El Torito boot catalogs & boot images.
    /// </summary>
    public static class IsoEngine
    {
        public const int SectorSize = 2048;

        public static IsoProject LoadIsoImage(string filePath)
        {
            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            if (fs.Length < 17 * SectorSize)
                throw new InvalidDataException("Файл слишком мал и не является корректным образом диска ISO 9660.");

            var project = new IsoProject
            {
                CurrentFilePath = filePath,
                IsDirty = false
            };
            project.Properties.FileSystem = IsoFileSystemType.Iso9660;

            uint primaryRootLba = 0;
            uint primaryRootLen = 0;
            uint jolietRootLba = 0;
            uint jolietRootLen = 0;
            uint bootCatalogLba = 0;
            bool hasUdf = false;

            byte[] sector = new byte[SectorSize];
            for (int secIdx = 16; secIdx < 64; secIdx++)
            {
                if ((long)(secIdx + 1) * SectorSize > fs.Length) break;
                fs.Seek((long)secIdx * SectorSize, SeekOrigin.Begin);
                fs.ReadExactly(sector, 0, SectorSize);

                byte vdType = sector[0];
                string stdId = Encoding.ASCII.GetString(sector, 1, 5);

                if (stdId == "BEA01" || stdId == "NSR02" || stdId == "NSR03")
                {
                    hasUdf = true;
                    continue;
                }

                if (stdId != "CD001") continue;

                if (vdType == 1) // Primary Volume Descriptor
                {
                    string volId = Encoding.ASCII.GetString(sector, 40, 32).Trim();
                    if (!string.IsNullOrEmpty(volId))
                        project.Properties.VolumeLabel = volId;

                    string sysId = Encoding.ASCII.GetString(sector, 8, 32).Trim();
                    if (!string.IsNullOrEmpty(sysId))
                        project.Properties.SystemIdentifier = sysId;

                    string pubId = Encoding.ASCII.GetString(sector, 318, 128).Trim();
                    if (!string.IsNullOrEmpty(pubId))
                        project.Properties.Publisher = pubId;

                    // Root directory record at offset 156 (34 bytes)
                    primaryRootLba = BinaryPrimitives.ReadUInt32LittleEndian(sector.AsSpan(156 + 2, 4));
                    primaryRootLen = BinaryPrimitives.ReadUInt32LittleEndian(sector.AsSpan(156 + 10, 4));
                }
                else if (vdType == 2) // Supplementary Volume Descriptor (Joliet)
                {
                    project.Properties.FileSystem |= IsoFileSystemType.Joliet;
                    string jolietVol = DecodeBigEndianUnicode(sector.AsSpan(40, 32)).Trim();
                    if (!string.IsNullOrEmpty(jolietVol))
                        project.Properties.VolumeLabel = jolietVol;

                    jolietRootLba = BinaryPrimitives.ReadUInt32LittleEndian(sector.AsSpan(156 + 2, 4));
                    jolietRootLen = BinaryPrimitives.ReadUInt32LittleEndian(sector.AsSpan(156 + 10, 4));
                }
                else if (vdType == 0) // El Torito Boot Record
                {
                    string bootSysId = Encoding.ASCII.GetString(sector, 7, 23).TrimEnd('\0', ' ');
                    if (bootSysId.StartsWith("EL TORITO SPECIFICATION", StringComparison.OrdinalIgnoreCase))
                    {
                        bootCatalogLba = BinaryPrimitives.ReadUInt32LittleEndian(sector.AsSpan(0x47, 4));
                    }
                }
                else if (vdType == 255) // Volume Descriptor Set Terminator
                {
                    break;
                }
            }

            if (hasUdf)
                project.Properties.FileSystem |= IsoFileSystemType.Udf;

            project.Root = new IsoNode
            {
                Name = string.IsNullOrWhiteSpace(project.Properties.VolumeLabel) ? "ISO_IMAGE" : project.Properties.VolumeLabel,
                IsDirectory = true,
                CreationTime = File.GetLastWriteTime(filePath)
            };

            bool useJoliet = jolietRootLba > 0 && jolietRootLen > 0;
            uint rootLba = useJoliet ? jolietRootLba : primaryRootLba;
            uint rootLen = useJoliet ? jolietRootLen : primaryRootLen;

            if (rootLba > 0 && rootLen > 0)
            {
                var visitedLbas = new HashSet<uint> { rootLba };
                ParseDirectoryRecords(fs, filePath, project.Root, rootLba, rootLen, useJoliet, visitedLbas);
            }

            if (bootCatalogLba > 0 && (long)(bootCatalogLba + 1) * SectorSize <= fs.Length)
            {
                ExtractElToritoBootImageFromStream(fs, bootCatalogLba, project);
            }

            project.IsDirty = false;
            return project;
        }

        private static void ExtractElToritoBootImageFromStream(FileStream fs, uint catalogLba, IsoProject project)
        {
            byte[] cat = new byte[SectorSize];
            fs.Seek((long)catalogLba * SectorSize, SeekOrigin.Begin);
            fs.ReadExactly(cat, 0, SectorSize);

            // Validation entry at 0x00 (header ID = 1), Initial/Default entry at 0x20 (boot indicator = 0x88)
            if (cat[0] == 0x01 && cat[0x20] == 0x88)
            {
                ushort sectorCount = BinaryPrimitives.ReadUInt16LittleEndian(cat.AsSpan(0x20 + 6, 2));
                uint loadRba = BinaryPrimitives.ReadUInt32LittleEndian(cat.AsSpan(0x20 + 8, 4));
                if (sectorCount == 0) sectorCount = 4; // Default 2KB
                // Check custom UltraISO Studio full length marker in unused bytes [0x20 + 12..16]
                uint exactBytes = BinaryPrimitives.ReadUInt32LittleEndian(cat.AsSpan(0x20 + 12, 4));
                int byteLen = exactBytes > 0 && exactBytes <= fs.Length - (long)loadRba * SectorSize
                    ? (int)exactBytes
                    : sectorCount * 512;

                if (loadRba > 0 && (long)loadRba * SectorSize + byteLen <= fs.Length)
                {
                    byte[] bootData = new byte[byteLen];
                    fs.Seek((long)loadRba * SectorSize, SeekOrigin.Begin);
                    fs.ReadExactly(bootData, 0, byteLen);
                    project.BootImageData = bootData;
                    project.BootImageName = "boot_eltorito.bif";
                }
            }
        }

        private static void ParseDirectoryRecords(
            FileStream fs,
            string isoPath,
            IsoNode parentDir,
            uint dirLba,
            uint dirLen,
            bool isJoliet,
            HashSet<uint> visitedLbas)
        {
            if ((long)dirLba * SectorSize + dirLen > fs.Length) return;

            byte[] buf = new byte[dirLen];
            fs.Seek((long)dirLba * SectorSize, SeekOrigin.Begin);
            fs.ReadExactly(buf, 0, (int)dirLen);

            int pos = 0;
            while (pos < buf.Length)
            {
                byte recordLen = buf[pos];
                if (recordLen == 0)
                {
                    // Move to next sector boundary
                    int nextSector = ((pos / SectorSize) + 1) * SectorSize;
                    if (nextSector <= pos) break;
                    pos = nextSector;
                    continue;
                }

                if (pos + recordLen > buf.Length || recordLen < 34) break;

                ReadOnlySpan<byte> rec = buf.AsSpan(pos, recordLen);
                uint extentLba = BinaryPrimitives.ReadUInt32LittleEndian(rec.Slice(2, 4));
                uint dataLen = BinaryPrimitives.ReadUInt32LittleEndian(rec.Slice(10, 4));
                byte flags = rec[25];
                byte nameLen = rec[32];

                DateTime dt = ParseIsoRecordingDate(rec.Slice(18, 7));

                if (nameLen > 0 && 33 + nameLen <= recordLen)
                {
                    ReadOnlySpan<byte> nameBytes = rec.Slice(33, nameLen);
                    // Skip '.' (0x00) and '..' (0x01)
                    if (!(nameLen == 1 && (nameBytes[0] == 0x00 || nameBytes[0] == 0x01)))
                    {
                        string name = isJoliet
                            ? DecodeBigEndianUnicode(nameBytes)
                            : Encoding.ASCII.GetString(nameBytes);

                        if (name.EndsWith(";1", StringComparison.Ordinal))
                            name = name[..^2];
                        if (name.EndsWith(".", StringComparison.Ordinal) && (flags & 0x02) == 0)
                            name = name.TrimEnd('.');

                        bool isDir = (flags & 0x02) != 0;
                        bool isHidden = (flags & 0x01) != 0;

                        var node = new IsoNode
                        {
                            Name = name,
                            IsDirectory = isDir,
                            CreationTime = dt,
                            Attributes = isHidden ? IsoNodeAttributes.Hidden : IsoNodeAttributes.Normal,
                            Parent = parentDir,
                            SourceIsoFilePath = isoPath,
                            SourceIsoOffset = (long)extentLba * SectorSize,
                            Size = isDir ? 0 : dataLen
                        };

                        parentDir.Children.Add(node);

                        if (isDir && extentLba > 0 && dataLen > 0 && visitedLbas.Add(extentLba))
                        {
                            ParseDirectoryRecords(fs, isoPath, node, extentLba, dataLen, isJoliet, visitedLbas);
                        }
                    }
                }

                pos += recordLen;
            }
        }

        public static void SaveIsoImage(IsoProject project, string outputFilePath, Action<int, string>? progressCallback = null)
        {
            string tempFile = outputFilePath + ".tmp_" + Guid.NewGuid().ToString("N")[..8];
            try
            {
                BuildIsoToStream(project, tempFile, progressCallback);
                if (File.Exists(outputFilePath))
                    File.Delete(outputFilePath);
                File.Move(tempFile, outputFilePath);
                project.CurrentFilePath = outputFilePath;
                project.IsDirty = false;
            }
            finally
            {
                if (File.Exists(tempFile))
                    try { File.Delete(tempFile); } catch { }
            }
        }

        private class DirLayoutEntry
        {
            public IsoNode Node = null!;
            public ushort ParentIndex;
            public uint PrimaryDirLba;
            public uint PrimaryDirBytes;
            public uint JolietDirLba;
            public uint JolietDirBytes;
            public byte[] PrimarySectorData = Array.Empty<byte>();
            public byte[] JolietSectorData = Array.Empty<byte>();
        }

        private static void BuildIsoToStream(IsoProject project, string outPath, Action<int, string>? progress)
        {
            progress?.Invoke(5, "Подготовка структуры папок и таблиц путей...");

            bool includeJoliet = project.Properties.FileSystem.HasFlag(IsoFileSystemType.Joliet);
            bool includeUdf = project.Properties.FileSystem.HasFlag(IsoFileSystemType.Udf);
            bool includeBoot = project.IsBootable && project.BootImageData != null && project.BootImageData.Length > 0;

            // Collect all directories in BFS order for ISO 9660 Path Table
            var dirEntries = new List<DirLayoutEntry>();
            var queue = new Queue<(IsoNode dir, ushort parentIdx)>();
            queue.Enqueue((project.Root, 1));

            while (queue.Count > 0)
            {
                var (curr, parentIdx) = queue.Dequeue();
                ushort myIdx = (ushort)(dirEntries.Count + 1);
                dirEntries.Add(new DirLayoutEntry { Node = curr, ParentIndex = parentIdx });

                foreach (var childDir in curr.Children.Where(c => c.IsDirectory).OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
                {
                    queue.Enqueue((childDir, myIdx));
                }
            }

            // Collect all files
            var allFiles = new List<IsoNode>();
            foreach (var d in dirEntries)
            {
                foreach (var f in d.Node.Children.Where(c => !c.IsDirectory).OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
                {
                    allFiles.Add(f);
                }
            }

            // Calculate LBA allocations:
            // Sectors 0..15: System Area (16 sectors)
            // Sector 16: Primary Volume Descriptor (PVD)
            // Optional: El Torito Boot Record Volume Descriptor
            // Optional: Supplementary Volume Descriptor (Joliet)
            // Optional: UDF Bridge Descriptors (BEA01, NSR02, TEA01)
            // Volume Descriptor Set Terminator
            uint currentLba = 16;
            uint pvdLba = currentLba++;
            uint bootVdLba = includeBoot ? currentLba++ : 0;
            uint jolietVdLba = includeJoliet ? currentLba++ : 0;
            uint udfBeaLba = includeUdf ? currentLba++ : 0;
            uint udfNsrLba = includeUdf ? currentLba++ : 0;
            uint udfTeaLba = includeUdf ? currentLba++ : 0;
            uint terminatorLba = currentLba++;

            // Boot catalog and boot image LBA
            uint bootCatalogLba = 0;
            uint bootImageLba = 0;
            uint bootImageSectors = 0;
            if (includeBoot && project.BootImageData != null)
            {
                bootCatalogLba = currentLba++;
                bootImageLba = currentLba;
                bootImageSectors = (uint)((project.BootImageData.Length + SectorSize - 1) / SectorSize);
                if (bootImageSectors == 0) bootImageSectors = 1;
                currentLba += bootImageSectors;
            }

            // Path tables (Primary L & M, Joliet L & M)
            uint primaryLPathLba = currentLba++;
            uint primaryMPathLba = currentLba++;
            uint jolietLPathLba = includeJoliet ? currentLba++ : 0;
            uint jolietMPathLba = includeJoliet ? currentLba++ : 0;

            // Pre-assign File LBAs first or Directory LBAs first (Directory LBAs first is standard)
            // Wait: to build directory records, we need file LBAs and directory LBAs!
            // Let's measure directory record sizes first using dummy LBAs, then re-serialize with exact LBAs.
            foreach (var d in dirEntries)
            {
                d.PrimarySectorData = SerializeDirectoryRecords(d.Node, d.ParentIndex, dirEntries, isJoliet: false, project.Properties);
                d.PrimaryDirBytes = (uint)d.PrimarySectorData.Length;
                d.PrimaryDirLba = currentLba;
                currentLba += d.PrimaryDirBytes / SectorSize;
            }

            if (includeJoliet)
            {
                foreach (var d in dirEntries)
                {
                    d.JolietSectorData = SerializeDirectoryRecords(d.Node, d.ParentIndex, dirEntries, isJoliet: true, project.Properties);
                    d.JolietDirBytes = (uint)d.JolietSectorData.Length;
                    d.JolietDirLba = currentLba;
                    currentLba += d.JolietDirBytes / SectorSize;
                }
            }

            // Now assign LBAs to all files
            foreach (var f in allFiles)
            {
                f.AssignedLba = currentLba;
                uint sectors = (uint)((f.Size + SectorSize - 1) / SectorSize);
                if (sectors == 0) sectors = 1;
                currentLba += sectors;
            }

            uint totalVolumeSectors = currentLba;

            // Re-serialize directory records now that all Directory LBAs and File LBAs are known!
            foreach (var d in dirEntries)
            {
                d.PrimarySectorData = SerializeDirectoryRecords(d.Node, d.ParentIndex, dirEntries, isJoliet: false, project.Properties);
                if (includeJoliet)
                    d.JolietSectorData = SerializeDirectoryRecords(d.Node, d.ParentIndex, dirEntries, isJoliet: true, project.Properties);
            }

            progress?.Invoke(20, "Запись дескрипторов тома и загрузочного сектора...");

            using var outFs = new FileStream(outPath, FileMode.Create, FileAccess.Write, FileShare.None);

            // 1. Write 16 empty sectors (System Area)
            byte[] zeroSector = new byte[SectorSize];
            for (int i = 0; i < 16; i++)
                outFs.Write(zeroSector, 0, SectorSize);

            // Build Path Tables
            byte[] primaryLPath = BuildPathTable(dirEntries, isJoliet: false, bigEndian: false);
            byte[] primaryMPath = BuildPathTable(dirEntries, isJoliet: false, bigEndian: true);
            byte[] jolietLPath = includeJoliet ? BuildPathTable(dirEntries, isJoliet: true, bigEndian: false) : Array.Empty<byte>();
            byte[] jolietMPath = includeJoliet ? BuildPathTable(dirEntries, isJoliet: true, bigEndian: true) : Array.Empty<byte>();

            // 2. Write Primary Volume Descriptor (Sector 16)
            byte[] pvd = BuildVolumeDescriptor(
                vdType: 1,
                isJoliet: false,
                project.Properties,
                totalVolumeSectors,
                (uint)primaryLPath.Length,
                primaryLPathLba,
                primaryMPathLba,
                dirEntries[0].PrimaryDirLba,
                dirEntries[0].PrimaryDirBytes);
            outFs.Write(pvd, 0, SectorSize);

            // 3. Write El Torito Boot Record Volume Descriptor (if bootable)
            if (includeBoot)
            {
                byte[] bvd = new byte[SectorSize];
                bvd[0] = 0x00; // Boot Record
                Encoding.ASCII.GetBytes("CD001").CopyTo(bvd, 1);
                bvd[6] = 0x01; // Version 1
                Encoding.ASCII.GetBytes("EL TORITO SPECIFICATION").CopyTo(bvd, 7);
                BinaryPrimitives.WriteUInt32LittleEndian(bvd.AsSpan(0x47, 4), bootCatalogLba);
                outFs.Write(bvd, 0, SectorSize);
            }

            // 4. Write Joliet Supplementary Volume Descriptor (if enabled)
            if (includeJoliet)
            {
                byte[] svd = BuildVolumeDescriptor(
                    vdType: 2,
                    isJoliet: true,
                    project.Properties,
                    totalVolumeSectors,
                    (uint)jolietLPath.Length,
                    jolietLPathLba,
                    jolietMPathLba,
                    dirEntries[0].JolietDirLba,
                    dirEntries[0].JolietDirBytes);
                outFs.Write(svd, 0, SectorSize);
            }

            // 5. Write UDF Bridge Extended Descriptors (BEA01, NSR02, TEA01) if UDF selected
            if (includeUdf)
            {
                byte[] bea = new byte[SectorSize];
                bea[0] = 0;
                Encoding.ASCII.GetBytes("BEA01").CopyTo(bea, 1);
                bea[6] = 1;
                outFs.Write(bea, 0, SectorSize);

                byte[] nsr = new byte[SectorSize];
                nsr[0] = 0;
                Encoding.ASCII.GetBytes("NSR02").CopyTo(nsr, 1);
                nsr[6] = 1;
                outFs.Write(nsr, 0, SectorSize);

                byte[] tea = new byte[SectorSize];
                tea[0] = 0;
                Encoding.ASCII.GetBytes("TEA01").CopyTo(tea, 1);
                tea[6] = 1;
                outFs.Write(tea, 0, SectorSize);
            }

            // 6. Write Volume Descriptor Set Terminator
            byte[] term = new byte[SectorSize];
            term[0] = 255;
            Encoding.ASCII.GetBytes("CD001").CopyTo(term, 1);
            term[6] = 1;
            outFs.Write(term, 0, SectorSize);

            // 7. Write Boot Catalog and Boot Image
            if (includeBoot && project.BootImageData != null)
            {
                byte[] cat = BuildElToritoCatalog(bootImageLba, project.BootImageData.Length, project.Properties.Publisher);
                outFs.Write(cat, 0, SectorSize);

                outFs.Write(project.BootImageData, 0, project.BootImageData.Length);
                int rem = (int)(bootImageSectors * SectorSize - project.BootImageData.Length);
                if (rem > 0)
                    outFs.Write(new byte[rem], 0, rem);
            }

            // 8. Write Path Tables (each padded to SectorSize)
            WritePaddedSector(outFs, primaryLPath);
            WritePaddedSector(outFs, primaryMPath);
            if (includeJoliet)
            {
                WritePaddedSector(outFs, jolietLPath);
                WritePaddedSector(outFs, jolietMPath);
            }

            // 9. Write Primary Directories
            progress?.Invoke(40, "Запись каталогов образа...");
            foreach (var d in dirEntries)
            {
                outFs.Write(d.PrimarySectorData, 0, d.PrimarySectorData.Length);
            }

            // 10. Write Joliet Directories
            if (includeJoliet)
            {
                foreach (var d in dirEntries)
                {
                    outFs.Write(d.JolietSectorData, 0, d.JolietSectorData.Length);
                }
            }

            // 11. Write File Extents
            int totalFiles = allFiles.Count;
            byte[] copyBuf = new byte[64 * 1024];
            for (int i = 0; i < totalFiles; i++)
            {
                var file = allFiles[i];
                int pct = 50 + (int)((i + 1) * 48.0 / Math.Max(1, totalFiles));
                progress?.Invoke(pct, $"Запись файла: {file.Name}");

                long written = 0;
                using (var src = file.OpenReadStream())
                {
                    int read;
                    while ((read = src.Read(copyBuf, 0, copyBuf.Length)) > 0)
                    {
                        outFs.Write(copyBuf, 0, read);
                        written += read;
                    }
                }

                uint expectedSectors = (uint)((file.Size + SectorSize - 1) / SectorSize);
                if (expectedSectors == 0) expectedSectors = 1;
                long targetBytes = (long)expectedSectors * SectorSize;
                long pad = targetBytes - written;
                while (pad > 0)
                {
                    int chunk = (int)Math.Min(pad, zeroSector.Length);
                    outFs.Write(zeroSector, 0, chunk);
                    pad -= chunk;
                }
            }

            outFs.Flush();
            progress?.Invoke(100, "Образ ISO успешно сформирован.");
        }

        private static void WritePaddedSector(Stream s, byte[] data)
        {
            s.Write(data, 0, Math.Min(data.Length, SectorSize));
            if (data.Length < SectorSize)
            {
                byte[] pad = new byte[SectorSize - data.Length];
                s.Write(pad, 0, pad.Length);
            }
        }

        private static byte[] BuildElToritoCatalog(uint bootImageLba, int bootImageBytes, string publisher)
        {
            byte[] cat = new byte[SectorSize];
            // Validation Entry (32 bytes)
            cat[0] = 0x01; // Header ID
            cat[1] = 0x00; // Platform 80x86
            string idStr = string.IsNullOrWhiteSpace(publisher) ? "UltraISO Studio x64" : publisher;
            byte[] idBytes = Encoding.ASCII.GetBytes(idStr.Length > 24 ? idStr[..24] : idStr);
            Array.Copy(idBytes, 0, cat, 4, idBytes.Length);
            cat[30] = 0x55;
            cat[31] = 0xAA;

            // Calculate 16-bit checksum so all 16-bit words in Validation Entry sum to 0
            ushort sum = 0;
            for (int i = 0; i < 32; i += 2)
            {
                if (i == 28) continue;
                sum += BinaryPrimitives.ReadUInt16LittleEndian(cat.AsSpan(i, 2));
            }
            ushort checksum = (ushort)(0 - sum);
            BinaryPrimitives.WriteUInt16LittleEndian(cat.AsSpan(28, 2), checksum);

            // Initial/Default Entry at offset 0x20 (32 bytes)
            cat[0x20 + 0] = 0x88; // Bootable
            cat[0x20 + 1] = 0x00; // No emulation
            BinaryPrimitives.WriteUInt16LittleEndian(cat.AsSpan(0x20 + 2, 2), 0x0000); // Load segment (default 07C0)
            cat[0x20 + 4] = 0x00; // System type
            ushort virtualSectors = (ushort)Math.Clamp((bootImageBytes + 511) / 512, 1, 0xFFFF);
            if (virtualSectors > 4) virtualSectors = 4; // Standard 4 virtual sectors (2048 bytes) for El Torito loader
            BinaryPrimitives.WriteUInt16LittleEndian(cat.AsSpan(0x20 + 6, 2), virtualSectors);
            BinaryPrimitives.WriteUInt32LittleEndian(cat.AsSpan(0x20 + 8, 4), bootImageLba);
            // Store exact byte length in unused bytes 12..16 for lossless round-trip extraction
            BinaryPrimitives.WriteUInt32LittleEndian(cat.AsSpan(0x20 + 12, 4), (uint)bootImageBytes);

            return cat;
        }

        private static byte[] BuildVolumeDescriptor(
            byte vdType,
            bool isJoliet,
            IsoProjectProperties props,
            uint totalSectors,
            uint pathTableSize,
            uint lPathLba,
            uint mPathLba,
            uint rootDirLba,
            uint rootDirLen)
        {
            byte[] vd = new byte[SectorSize];
            vd[0] = vdType;
            Encoding.ASCII.GetBytes("CD001").CopyTo(vd, 1);
            vd[6] = 1; // Version

            if (isJoliet)
            {
                WriteJolietPaddedString(vd.AsSpan(8, 32), props.SystemIdentifier);
                WriteJolietPaddedString(vd.AsSpan(40, 32), props.VolumeLabel);
                // Escape sequences for UCS-2 Level 3: "%/@" (0x25, 0x2F, 0x40) at offset 88
                vd[88] = 0x25;
                vd[89] = 0x2F;
                vd[90] = 0x40;
            }
            else
            {
                WriteAsciiPaddedString(vd.AsSpan(8, 32), props.SystemIdentifier.ToUpperInvariant());
                WriteAsciiPaddedString(vd.AsSpan(40, 32), SanitizeIsoVolumeLabel(props.VolumeLabel));
            }

            WriteBothEndianUInt32(vd.AsSpan(80, 8), totalSectors);
            WriteBothEndianUInt16(vd.AsSpan(120, 4), 1); // Volume Set Size
            WriteBothEndianUInt16(vd.AsSpan(124, 4), 1); // Volume Sequence Number
            WriteBothEndianUInt16(vd.AsSpan(128, 4), (ushort)SectorSize); // Logical Block Size
            WriteBothEndianUInt32(vd.AsSpan(132, 8), pathTableSize);

            BinaryPrimitives.WriteUInt32LittleEndian(vd.AsSpan(140, 4), lPathLba);
            BinaryPrimitives.WriteUInt32BigEndian(vd.AsSpan(148, 4), mPathLba);

            // Root Directory Record (34 bytes at offset 156)
            byte[] rootRec = CreateSingleDirectoryRecord(
                new byte[] { 0x00 },
                rootDirLba,
                rootDirLen,
                DateTime.Now,
                isDir: true,
                isHidden: false);
            Array.Copy(rootRec, 0, vd, 156, 34);

            WriteAsciiPaddedString(vd.AsSpan(190, 128), props.VolumeLabel);
            WriteAsciiPaddedString(vd.AsSpan(318, 128), props.Publisher);
            WriteAsciiPaddedString(vd.AsSpan(446, 128), props.DataPreparer);
            WriteAsciiPaddedString(vd.AsSpan(574, 128), props.ApplicationIdentifier);

            byte[] nowDec = FormatDecimalDateTime(DateTime.Now);
            Array.Copy(nowDec, 0, vd, 813, 17); // Creation Date
            Array.Copy(nowDec, 0, vd, 830, 17); // Modification Date
            vd[881] = 1; // File Structure Version

            return vd;
        }

        private static byte[] BuildPathTable(List<DirLayoutEntry> dirs, bool isJoliet, bool bigEndian)
        {
            using var ms = new MemoryStream();
            for (int i = 0; i < dirs.Count; i++)
            {
                var d = dirs[i];
                byte[] nameBytes;
                if (i == 0)
                {
                    nameBytes = new byte[] { 0x00 };
                }
                else
                {
                    nameBytes = isJoliet
                        ? EncodeBigEndianUnicode(TruncateString(d.Node.Name, 64))
                        : Encoding.ASCII.GetBytes(SanitizeIso9660Identifier(d.Node.Name, isDir: true, allowLong: true));
                }

                byte lenDi = (byte)Math.Min(nameBytes.Length, 254);
                ms.WriteByte(lenDi);
                ms.WriteByte(0); // Extended attribute length

                uint lba = isJoliet ? d.JolietDirLba : d.PrimaryDirLba;
                Span<byte> buf4 = stackalloc byte[4];
                if (bigEndian) BinaryPrimitives.WriteUInt32BigEndian(buf4, lba);
                else BinaryPrimitives.WriteUInt32LittleEndian(buf4, lba);
                ms.Write(buf4);

                Span<byte> buf2 = stackalloc byte[2];
                if (bigEndian) BinaryPrimitives.WriteUInt16BigEndian(buf2, d.ParentIndex);
                else BinaryPrimitives.WriteUInt16LittleEndian(buf2, d.ParentIndex);
                ms.Write(buf2);

                ms.Write(nameBytes, 0, lenDi);
                if (lenDi % 2 != 0)
                    ms.WriteByte(0);
            }
            return ms.ToArray();
        }

        private static byte[] SerializeDirectoryRecords(
            IsoNode dir,
            ushort parentIdx,
            List<DirLayoutEntry> allDirs,
            bool isJoliet,
            IsoProjectProperties props)
        {
            var myEntry = allDirs.First(e => e.Node == dir);
            var parentEntry = allDirs[parentIdx - 1];

            uint myLba = isJoliet ? myEntry.JolietDirLba : myEntry.PrimaryDirLba;
            uint myLen = isJoliet ? myEntry.JolietDirBytes : myEntry.PrimaryDirBytes;
            if (myLen == 0) myLen = SectorSize;

            uint parentLba = isJoliet ? parentEntry.JolietDirLba : parentEntry.PrimaryDirLba;
            uint parentLen = isJoliet ? parentEntry.JolietDirBytes : parentEntry.PrimaryDirBytes;
            if (parentLen == 0) parentLen = SectorSize;

            var records = new List<byte[]>
            {
                // '.' entry
                CreateSingleDirectoryRecord(new byte[] { 0x00 }, myLba, myLen, dir.CreationTime, isDir: true, isHidden: false),
                // '..' entry
                CreateSingleDirectoryRecord(new byte[] { 0x01 }, parentLba, parentLen, parentEntry.Node.CreationTime, isDir: true, isHidden: false)
            };

            var sortedChildren = dir.Children
                .OrderByDescending(c => c.IsDirectory)
                .ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            foreach (var child in sortedChildren)
            {
                uint childLba;
                uint childLen;
                if (child.IsDirectory)
                {
                    var ce = allDirs.First(e => e.Node == child);
                    childLba = isJoliet ? ce.JolietDirLba : ce.PrimaryDirLba;
                    childLen = isJoliet ? ce.JolietDirBytes : ce.PrimaryDirBytes;
                    if (childLen == 0) childLen = SectorSize;
                }
                else
                {
                    childLba = child.AssignedLba;
                    childLen = (uint)Math.Min(child.Size, 0xFFFFFFFFL);
                }

                byte[] nameBytes;
                if (isJoliet)
                {
                    string jName = TruncateString(child.Name, props.AllowLongFileNames ? 103 : 64);
                    if (!child.IsDirectory && !props.OmitVersionNumbers)
                        jName += ";1";
                    nameBytes = EncodeBigEndianUnicode(jName);
                }
                else
                {
                    string iName = SanitizeIso9660Identifier(child.Name, child.IsDirectory, props.AllowLongFileNames);
                    if (!child.IsDirectory && !props.OmitVersionNumbers)
                        iName += ";1";
                    nameBytes = Encoding.ASCII.GetBytes(iName);
                }

                bool hidden = child.Attributes.HasFlag(IsoNodeAttributes.Hidden);
                records.Add(CreateSingleDirectoryRecord(nameBytes, childLba, childLen, child.CreationTime, child.IsDirectory, hidden));
            }

            // Pack records into sectors without crossing sector boundaries
            using var ms = new MemoryStream();
            int offsetInSector = 0;
            foreach (var rec in records)
            {
                if (offsetInSector + rec.Length > SectorSize)
                {
                    int pad = SectorSize - offsetInSector;
                    ms.Write(new byte[pad], 0, pad);
                    offsetInSector = 0;
                }
                ms.Write(rec, 0, rec.Length);
                offsetInSector += rec.Length;
            }

            if (offsetInSector > 0 || ms.Length == 0)
            {
                int pad = SectorSize - offsetInSector;
                ms.Write(new byte[pad], 0, pad);
            }

            byte[] finalBuf = ms.ToArray();
            // Update '.' self length in first record so it matches actual sector count
            WriteBothEndianUInt32(finalBuf.AsSpan(10, 8), (uint)finalBuf.Length);
            return finalBuf;
        }

        private static byte[] CreateSingleDirectoryRecord(
            byte[] nameBytes,
            uint extentLba,
            uint dataLen,
            DateTime dt,
            bool isDir,
            bool isHidden)
        {
            byte nameLen = (byte)Math.Min(nameBytes.Length, 220);
            int recLen = 33 + nameLen;
            if (recLen % 2 != 0) recLen++;

            byte[] rec = new byte[recLen];
            rec[0] = (byte)recLen;
            rec[1] = 0; // Extended Attribute Record Length
            WriteBothEndianUInt32(rec.AsSpan(2, 8), extentLba);
            WriteBothEndianUInt32(rec.AsSpan(10, 8), dataLen);
            WriteIsoRecordingDate(rec.AsSpan(18, 7), dt);

            byte flags = 0;
            if (isHidden) flags |= 0x01;
            if (isDir) flags |= 0x02;
            rec[25] = flags;
            rec[26] = 0; // File unit size
            rec[27] = 0; // Interleave gap
            WriteBothEndianUInt16(rec.AsSpan(28, 4), 1); // Volume sequence number
            rec[32] = nameLen;
            Array.Copy(nameBytes, 0, rec, 33, nameLen);
            return rec;
        }

        private static void WriteBothEndianUInt32(Span<byte> dest, uint val)
        {
            BinaryPrimitives.WriteUInt32LittleEndian(dest.Slice(0, 4), val);
            BinaryPrimitives.WriteUInt32BigEndian(dest.Slice(4, 4), val);
        }

        private static void WriteBothEndianUInt16(Span<byte> dest, ushort val)
        {
            BinaryPrimitives.WriteUInt16LittleEndian(dest.Slice(0, 2), val);
            BinaryPrimitives.WriteUInt16BigEndian(dest.Slice(2, 2), val);
        }

        private static void WriteIsoRecordingDate(Span<byte> dest, DateTime dt)
        {
            dest[0] = (byte)Math.Clamp(dt.Year - 1900, 0, 255);
            dest[1] = (byte)dt.Month;
            dest[2] = (byte)dt.Day;
            dest[3] = (byte)dt.Hour;
            dest[4] = (byte)dt.Minute;
            dest[5] = (byte)dt.Second;
            dest[6] = 0; // GMT offset
        }

        private static DateTime ParseIsoRecordingDate(ReadOnlySpan<byte> src)
        {
            try
            {
                int year = 1900 + src[0];
                int month = Math.Clamp((int)src[1], 1, 12);
                int day = Math.Clamp((int)src[2], 1, 28);
                int hour = Math.Clamp((int)src[3], 0, 23);
                int min = Math.Clamp((int)src[4], 0, 59);
                int sec = Math.Clamp((int)src[5], 0, 59);
                return new DateTime(year, month, day, hour, min, sec);
            }
            catch
            {
                return DateTime.Now;
            }
        }

        private static byte[] FormatDecimalDateTime(DateTime dt)
        {
            string s = dt.ToString("yyyyMMddHHmmssff");
            byte[] res = new byte[17];
            Encoding.ASCII.GetBytes(s, 0, 16, res, 0);
            res[16] = 0;
            return res;
        }

        private static void WriteAsciiPaddedString(Span<byte> dest, string text)
        {
            dest.Fill((byte)' ');
            if (string.IsNullOrEmpty(text)) return;
            byte[] ascii = Encoding.ASCII.GetBytes(text);
            ascii.AsSpan(0, Math.Min(ascii.Length, dest.Length)).CopyTo(dest);
        }

        private static void WriteJolietPaddedString(Span<byte> dest, string text)
        {
            dest.Clear();
            for (int i = 0; i < dest.Length - 1; i += 2)
            {
                dest[i] = 0x00;
                dest[i + 1] = 0x20;
            }
            if (string.IsNullOrEmpty(text)) return;
            byte[] ucs2 = EncodeBigEndianUnicode(text);
            ucs2.AsSpan(0, Math.Min(ucs2.Length, dest.Length)).CopyTo(dest);
        }

        private static string DecodeBigEndianUnicode(ReadOnlySpan<byte> bytes)
        {
            return Encoding.BigEndianUnicode.GetString(bytes).TrimEnd('\0');
        }

        private static byte[] EncodeBigEndianUnicode(string text)
        {
            return Encoding.BigEndianUnicode.GetBytes(text);
        }

        private static string TruncateString(string s, int maxChars)
        {
            return s.Length <= maxChars ? s : s[..maxChars];
        }

        private static string SanitizeIsoVolumeLabel(string label)
        {
            if (string.IsNullOrWhiteSpace(label)) return "ULTRAISO_DISC";
            var sb = new StringBuilder();
            foreach (char c in label.ToUpperInvariant())
            {
                if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_')
                    sb.Append(c);
                else
                    sb.Append('_');
            }
            return TruncateString(sb.ToString(), 32);
        }

        private static string SanitizeIso9660Identifier(string name, bool isDir, bool allowLong)
        {
            var sb = new StringBuilder();
            foreach (char c in name.ToUpperInvariant())
            {
                if ((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '.' || c == '-')
                    sb.Append(c);
                else
                    sb.Append('_');
            }
            string cleaned = sb.ToString();
            if (string.IsNullOrEmpty(cleaned)) cleaned = "ITEM";
            int maxLen = allowLong ? 31 : (isDir ? 8 : 12);
            return TruncateString(cleaned, maxLen);
        }
    }
}
