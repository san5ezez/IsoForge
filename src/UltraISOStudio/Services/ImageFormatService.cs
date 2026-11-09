using System;
using System.Buffers.Binary;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;

namespace UltraISOStudio.Services
{
    public class ChecksumReport
    {
        public string FilePath { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public string Crc32 { get; set; } = string.Empty;
        public string Md5 { get; set; } = string.Empty;
        public string Sha1 { get; set; } = string.Empty;
        public string Sha256 { get; set; } = string.Empty;
    }

    /// <summary>
    /// Handles ISZ (Zipped ISO) compression/decompression, format conversion from MDF/NRG/IMG/BIN to ISO,
    /// and cryptographic checksum calculation (CRC32, MD5, SHA-1, SHA-256).
    /// </summary>
    public static class ImageFormatService
    {
        private static readonly byte[] IszSignature = Encoding.ASCII.GetBytes("IsZ!");

        /// <summary>
        /// Compresses a standard ISO image into a segmented ZLIB/Deflate .ISZ image with header index.
        /// </summary>
        public static void CompressIsoToIsz(string isoFilePath, string iszOutputPath, int compressionLevel = 6, Action<int, string>? progress = null)
        {
            using var inFs = new FileStream(isoFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            using var outFs = new FileStream(iszOutputPath, FileMode.Create, FileAccess.Write, FileShare.None);

            const int chunkSize = 64 * 1024; // 64 KB blocks
            long totalLen = inFs.Length;
            int numChunks = (int)((totalLen + chunkSize - 1) / chunkSize);

            // 64-byte ISZ Header:
            // [0..3]   "IsZ!"
            // [4]      Header size in bytes (64)
            // [5]      Version (1)
            // [6..9]   Volume serial
            // [12..19] Total uncompressed size (int64)
            // [20..23] Chunk size (int32)
            // [24..27] Number of chunks (int32)
            // [28..31] Offset to chunk table (64)
            byte[] header = new byte[64];
            Array.Copy(IszSignature, 0, header, 0, 4);
            header[4] = 64;
            header[5] = 1;
            BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(6, 4), 0x5549534F);
            BinaryPrimitives.WriteInt64LittleEndian(header.AsSpan(12, 8), totalLen);
            BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(20, 4), chunkSize);
            BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(24, 4), numChunks);
            BinaryPrimitives.WriteInt32LittleEndian(header.AsSpan(28, 4), 64);

            outFs.Write(header, 0, 64);

            // Reserve space for chunk table (each entry: 8 bytes offset + 4 bytes compressed length = 12 bytes)
            long tableOffset = outFs.Position;
            byte[] tableBytes = new byte[numChunks * 12];
            outFs.Write(tableBytes, 0, tableBytes.Length);

            byte[] readBuf = new byte[chunkSize];
            var level = compressionLevel >= 7 ? CompressionLevel.SmallestSize : CompressionLevel.Optimal;

            for (int i = 0; i < numChunks; i++)
            {
                int read = inFs.Read(readBuf, 0, chunkSize);
                long chunkOffset = outFs.Position;

                using var ms = new MemoryStream();
                using (var z = new ZLibStream(ms, level, leaveOpen: true))
                {
                    z.Write(readBuf, 0, read);
                }
                byte[] compressed = ms.ToArray();
                outFs.Write(compressed, 0, compressed.Length);

                BinaryPrimitives.WriteInt64LittleEndian(tableBytes.AsSpan(i * 12, 8), chunkOffset);
                BinaryPrimitives.WriteInt32LittleEndian(tableBytes.AsSpan(i * 12 + 8, 4), compressed.Length);

                if (i % 16 == 0 || i == numChunks - 1)
                {
                    int pct = (int)((i + 1) * 100.0 / Math.Max(1, numChunks));
                    progress?.Invoke(pct, $"Сжатие в формат ISZ: блок {i + 1} из {numChunks}...");
                }
            }

            // Write populated chunk table
            outFs.Seek(tableOffset, SeekOrigin.Begin);
            outFs.Write(tableBytes, 0, tableBytes.Length);
            outFs.Flush();
            progress?.Invoke(100, "Сжатие в формат ISZ успешно завершено.");
        }

        /// <summary>
        /// Decompresses an .ISZ image back to a standard .ISO file.
        /// </summary>
        public static void DecompressIszToIso(string iszFilePath, string isoOutputPath, Action<int, string>? progress = null)
        {
            using var inFs = new FileStream(iszFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            byte[] header = new byte[64];
            if (inFs.Read(header, 0, 64) < 64 || Encoding.ASCII.GetString(header, 0, 4) != "IsZ!")
                throw new InvalidDataException("Файл не имеет сигнатуры сжатого образа IsZ!");

            long totalUncompressed = BinaryPrimitives.ReadInt64LittleEndian(header.AsSpan(12, 8));
            int chunkSize = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(20, 4));
            int numChunks = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(24, 4));
            int tableOffset = BinaryPrimitives.ReadInt32LittleEndian(header.AsSpan(28, 4));

            inFs.Seek(tableOffset, SeekOrigin.Begin);
            byte[] tableBytes = new byte[numChunks * 12];
            inFs.ReadExactly(tableBytes, 0, tableBytes.Length);

            using var outFs = new FileStream(isoOutputPath, FileMode.Create, FileAccess.Write, FileShare.None);
            byte[] decompBuf = new byte[Math.Max(chunkSize, 65536)];

            for (int i = 0; i < numChunks; i++)
            {
                long chunkOffset = BinaryPrimitives.ReadInt64LittleEndian(tableBytes.AsSpan(i * 12, 8));
                int compLen = BinaryPrimitives.ReadInt32LittleEndian(tableBytes.AsSpan(i * 12 + 8, 4));

                byte[] compData = new byte[compLen];
                inFs.Seek(chunkOffset, SeekOrigin.Begin);
                inFs.ReadExactly(compData, 0, compLen);

                using var ms = new MemoryStream(compData);
                using var z = new ZLibStream(ms, CompressionMode.Decompress);
                int read;
                while ((read = z.Read(decompBuf, 0, decompBuf.Length)) > 0)
                {
                    outFs.Write(decompBuf, 0, read);
                }

                if (i % 16 == 0 || i == numChunks - 1)
                {
                    int pct = (int)((i + 1) * 100.0 / Math.Max(1, numChunks));
                    progress?.Invoke(pct, $"Распаковка ISZ: блок {i + 1} из {numChunks}...");
                }
            }

            outFs.SetLength(totalUncompressed);
            outFs.Flush();
            progress?.Invoke(100, "Распаковка ISZ завершена.");
        }

        /// <summary>
        /// Converts MDF (Alcohol 120%), NRG (Nero), IMG/BIN/RAW disc images into standard 2048-byte/sector ISO 9660 images.
        /// Automatically detects 2048-byte vs 2352-byte RAW CD sectors and Nero/Alcohol header offsets.
        /// </summary>
        public static void ConvertToStandardIso(string sourceImagePath, string targetIsoPath, Action<int, string>? progress = null)
        {
            string ext = Path.GetExtension(sourceImagePath).ToLowerInvariant();
            if (ext == ".isz")
            {
                DecompressIszToIso(sourceImagePath, targetIsoPath, progress);
                return;
            }

            using var inFs = new FileStream(sourceImagePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            long fileLen = inFs.Length;
            if (fileLen < 17 * 2048)
                throw new InvalidDataException("Исходный файл слишком мал для конвертации в ISO.");

            // Probe layout:
            // 1. Standard 2048-byte sector where PVD "CD001" is at 16 * 2048 = 0x8000
            // 2. Nero .NRG v1/v2 where 307200 bytes (150 sectors) header precedes 2048-byte sectors (PVD at 0x8000 + 307200)
            // 3. RAW 2352-byte sectors (MDF / BIN / IMG Mode 1 or Mode 2) where each sector has 16 or 24 byte sync/header + 2048 data
            int sectorStride = 2048;
            long startOffset = 0;
            int dataOffsetInSector = 0;
            long payloadEnd = fileLen;

            if (CheckCd001At(inFs, 16 * 2048 + 1))
            {
                sectorStride = 2048;
                startOffset = 0;
                dataOffsetInSector = 0;
            }
            else if (CheckCd001At(inFs, 307200 + 16 * 2048 + 1)) // Nero NRG header
            {
                sectorStride = 2048;
                startOffset = 307200;
                dataOffsetInSector = 0;
            }
            else if (CheckCd001At(inFs, 16 * 2352 + 16 + 1)) // RAW 2352 Mode 1 (MDF / BIN)
            {
                sectorStride = 2352;
                startOffset = 0;
                dataOffsetInSector = 16;
            }
            else if (CheckCd001At(inFs, 16 * 2352 + 24 + 1)) // RAW 2352 Mode 2 XA (MDF / BIN)
            {
                sectorStride = 2352;
                startOffset = 0;
                dataOffsetInSector = 24;
            }
            else if (CheckCd001At(inFs, 16 * 2448 + 16 + 1)) // RAW 2448 with subchannel (MDF)
            {
                sectorStride = 2448;
                startOffset = 0;
                dataOffsetInSector = 16;
            }

            // Strip Nero footer ("NER5" or "NERO" in last 12 bytes) if present
            if (fileLen >= 12)
            {
                byte[] tail = new byte[12];
                inFs.Seek(fileLen - 12, SeekOrigin.Begin);
                inFs.ReadExactly(tail, 0, 12);
                string sig = Encoding.ASCII.GetString(tail, 0, 4);
                if (sig == "NER5")
                {
                    long footerOffset = BinaryPrimitives.ReadInt64BigEndian(tail.AsSpan(4, 8));
                    if (footerOffset > startOffset && footerOffset < fileLen)
                        payloadEnd = footerOffset;
                }
            }

            using var outFs = new FileStream(targetIsoPath, FileMode.Create, FileAccess.Write, FileShare.None);
            long totalSectors = (payloadEnd - startOffset) / sectorStride;
            byte[] rawSector = new byte[sectorStride];

            inFs.Seek(startOffset, SeekOrigin.Begin);
            for (long s = 0; s < totalSectors; s++)
            {
                int read = inFs.Read(rawSector, 0, sectorStride);
                if (read < dataOffsetInSector + 2048) break;
                outFs.Write(rawSector, dataOffsetInSector, 2048);

                if (s % 512 == 0 || s == totalSectors - 1)
                {
                    int pct = (int)((s + 1) * 100.0 / Math.Max(1, totalSectors));
                    progress?.Invoke(pct, $"Конвертация {ext.ToUpperInvariant()} -> ISO ({pct}%)...");
                }
            }

            outFs.Flush();
            progress?.Invoke(100, "Конвертация в формат ISO успешно завершена.");
        }

        private static bool CheckCd001At(Stream s, long pos)
        {
            if (pos + 5 > s.Length) return false;
            s.Seek(pos, SeekOrigin.Begin);
            Span<byte> buf = stackalloc byte[5];
            if (s.Read(buf) < 5) return false;
            return buf[0] == (byte)'C' && buf[1] == (byte)'D' && buf[2] == (byte)'0' && buf[3] == (byte)'0' && buf[4] == (byte)'1';
        }

        public static ChecksumReport ComputeChecksums(string filePath, Action<int>? progress = null)
        {
            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            using var md5 = MD5.Create();
            using var sha1 = SHA1.Create();
            using var sha256 = SHA256.Create();

            uint crc = 0xFFFFFFFF;
            uint[] crcTable = BuildCrc32Table();

            byte[] buffer = new byte[128 * 1024];
            long total = Math.Max(1, fs.Length);
            long processed = 0;
            int read;

            while ((read = fs.Read(buffer, 0, buffer.Length)) > 0)
            {
                md5.TransformBlock(buffer, 0, read, null, 0);
                sha1.TransformBlock(buffer, 0, read, null, 0);
                sha256.TransformBlock(buffer, 0, read, null, 0);

                for (int i = 0; i < read; i++)
                {
                    byte idx = (byte)((crc ^ buffer[i]) & 0xFF);
                    crc = (crc >> 8) ^ crcTable[idx];
                }

                processed += read;
                progress?.Invoke((int)(processed * 100 / total));
            }

            md5.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
            sha1.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
            sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
            crc ^= 0xFFFFFFFF;

            return new ChecksumReport
            {
                FilePath = filePath,
                FileSize = fs.Length,
                Crc32 = crc.ToString("X8"),
                Md5 = Convert.ToHexString(md5.Hash ?? Array.Empty<byte>()),
                Sha1 = Convert.ToHexString(sha1.Hash ?? Array.Empty<byte>()),
                Sha256 = Convert.ToHexString(sha256.Hash ?? Array.Empty<byte>())
            };
        }

        private static uint[] BuildCrc32Table()
        {
            uint[] table = new uint[256];
            const uint poly = 0xEDB88320;
            for (uint i = 0; i < 256; i++)
            {
                uint c = i;
                for (int j = 0; j < 8; j++)
                {
                    c = (c & 1) != 0 ? (poly ^ (c >> 1)) : (c >> 1);
                }
                table[i] = c;
            }
            return table;
        }
    }
}
