using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace UltraISOStudio.Core
{
    [Flags]
    public enum IsoFileSystemType
    {
        Iso9660 = 1,
        Joliet = 2,
        Udf = 4
    }

    [Flags]
    public enum IsoNodeAttributes
    {
        Normal = 0,
        Hidden = 1,
        ReadOnly = 2,
        System = 4,
        Archive = 8
    }

    public class IsoProjectProperties
    {
        public string VolumeLabel { get; set; } = "ULTRAISO_DISC";
        public string SystemIdentifier { get; set; } = "WIN64";
        public string Publisher { get; set; } = "UltraISO Studio x64";
        public string DataPreparer { get; set; } = "UltraISO Studio Engine";
        public string ApplicationIdentifier { get; set; } = "ULTRAISO STUDIO X64 V1.0";
        public IsoFileSystemType FileSystem { get; set; } = IsoFileSystemType.Iso9660 | IsoFileSystemType.Joliet | IsoFileSystemType.Udf;
        public bool AllowLongFileNames { get; set; } = true; // Up to 103/255 chars via Joliet/UDF
        public bool AllowFilesOver4GB { get; set; } = true;  // Multi-extent & UDF support
        public bool OmitVersionNumbers { get; set; } = true;
    }

    public class IsoNode
    {
        public string Name { get; set; } = string.Empty;
        public bool IsDirectory { get; set; }
        public DateTime CreationTime { get; set; } = DateTime.Now;
        public IsoNodeAttributes Attributes { get; set; } = IsoNodeAttributes.Normal;
        public IsoNode? Parent { get; set; }
        public List<IsoNode> Children { get; set; } = new List<IsoNode>();

        // File content source: either backed by in-memory byte[], local file path, or slice of source ISO
        public byte[]? InMemoryData { get; set; }
        public string? SourceLocalFilePath { get; set; }
        public string? SourceIsoFilePath { get; set; }
        public long SourceIsoOffset { get; set; }
        public long Size { get; set; }

        // Layout calculation during ISO build
        internal uint AssignedLba { get; set; }

        public string FullIsoPath
        {
            get
            {
                if (Parent == null) return "/";
                var stack = new Stack<string>();
                var cur = this;
                while (cur != null && cur.Parent != null)
                {
                    stack.Push(cur.Name);
                    cur = cur.Parent;
                }
                return "/" + string.Join("/", stack);
            }
        }

        public Stream OpenReadStream()
        {
            if (IsDirectory) throw new InvalidOperationException("Cannot open stream on a directory.");
            if (InMemoryData != null)
                return new MemoryStream(InMemoryData, writable: false);
            if (!string.IsNullOrEmpty(SourceLocalFilePath) && File.Exists(SourceLocalFilePath))
                return new FileStream(SourceLocalFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            if (!string.IsNullOrEmpty(SourceIsoFilePath) && File.Exists(SourceIsoFilePath))
            {
                var fs = new FileStream(SourceIsoFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                return new SubStream(fs, SourceIsoOffset, Size);
            }
            return new MemoryStream(Array.Empty<byte>());
        }

        public long ComputeTotalBytes()
        {
            if (!IsDirectory) return Size;
            long sum = 2048; // Directory sector overhead
            foreach (var child in Children)
                sum += child.ComputeTotalBytes();
            return sum;
        }

        public int CountAllFiles()
        {
            if (!IsDirectory) return 1;
            return Children.Sum(c => c.CountAllFiles());
        }

        public int CountAllDirectories()
        {
            if (!IsDirectory) return 0;
            return Children.Count(c => c.IsDirectory) + Children.Sum(c => c.CountAllDirectories());
        }
    }

    public class SubStream : Stream
    {
        private readonly Stream _baseStream;
        private readonly long _offset;
        private readonly long _length;
        private long _position;

        public SubStream(Stream baseStream, long offset, long length)
        {
            _baseStream = baseStream;
            _offset = offset;
            _length = length;
            _position = 0;
            _baseStream.Seek(_offset, SeekOrigin.Begin);
        }

        public override bool CanRead => true;
        public override bool CanSeek => true;
        public override bool CanWrite => false;
        public override long Length => _length;
        public override long Position
        {
            get => _position;
            set => Seek(value, SeekOrigin.Begin);
        }

        public override void Flush() { }

        public override int Read(byte[] buffer, int offset, int count)
        {
            long remaining = _length - _position;
            if (remaining <= 0) return 0;
            if (count > remaining) count = (int)remaining;
            _baseStream.Seek(_offset + _position, SeekOrigin.Begin);
            int read = _baseStream.Read(buffer, offset, count);
            _position += read;
            return read;
        }

        public override long Seek(long offset, SeekOrigin origin)
        {
            long newPos = origin switch
            {
                SeekOrigin.Begin => offset,
                SeekOrigin.Current => _position + offset,
                SeekOrigin.End => _length + offset,
                _ => _position
            };
            _position = Math.Clamp(newPos, 0, _length);
            return _position;
        }

        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

        protected override void Dispose(bool disposing)
        {
            if (disposing) _baseStream.Dispose();
            base.Dispose(disposing);
        }
    }

    public class IsoProject
    {
        public string? CurrentFilePath { get; set; }
        public bool IsDirty { get; set; }
        public IsoProjectProperties Properties { get; set; } = new IsoProjectProperties();
        public IsoNode Root { get; set; }

        // Bootable El Torito data
        public bool IsBootable => BootImageData != null && BootImageData.Length > 0;
        public byte[]? BootImageData { get; set; }
        public string BootImageName { get; set; } = "boot.bif";

        public IsoProject()
        {
            Root = new IsoNode
            {
                Name = Properties.VolumeLabel,
                IsDirectory = true,
                CreationTime = DateTime.Now
            };
        }

        public void ResetNew()
        {
            CurrentFilePath = null;
            IsDirty = false;
            Properties = new IsoProjectProperties();
            BootImageData = null;
            BootImageName = "boot.bif";
            Root = new IsoNode
            {
                Name = Properties.VolumeLabel,
                IsDirectory = true,
                CreationTime = DateTime.Now
            };
        }

        public IsoNode AddFolder(IsoNode parentDir, string folderName)
        {
            if (!parentDir.IsDirectory)
                throw new ArgumentException("Parent node must be a directory.");

            var existing = parentDir.Children.FirstOrDefault(
                c => c.IsDirectory && string.Equals(c.Name, folderName, StringComparison.OrdinalIgnoreCase));
            if (existing != null) return existing;

            var node = new IsoNode
            {
                Name = folderName,
                IsDirectory = true,
                CreationTime = DateTime.Now,
                Parent = parentDir
            };
            parentDir.Children.Add(node);
            IsDirty = true;
            return node;
        }

        public IsoNode AddLocalFile(IsoNode parentDir, string localFilePath)
        {
            var fi = new FileInfo(localFilePath);
            if (!fi.Exists) throw new FileNotFoundException("Local file not found", localFilePath);

            if (!Properties.AllowFilesOver4GB && fi.Length >= 4294967295L && !Properties.FileSystem.HasFlag(IsoFileSystemType.Udf))
            {
                throw new InvalidOperationException(
                    $"Файл '{fi.Name}' ({fi.Length / (1024 * 1024)} МБ) превышает 4 ГБ. Включите поддержку UDF в меню Файл -> Свойства.");
            }

            var existing = parentDir.Children.FirstOrDefault(
                c => !c.IsDirectory && string.Equals(c.Name, fi.Name, StringComparison.OrdinalIgnoreCase));
            if (existing != null)
                parentDir.Children.Remove(existing);

            var attr = IsoNodeAttributes.Normal;
            if (fi.Attributes.HasFlag(FileAttributes.Hidden)) attr |= IsoNodeAttributes.Hidden;
            if (fi.Attributes.HasFlag(FileAttributes.ReadOnly)) attr |= IsoNodeAttributes.ReadOnly;
            if (fi.Attributes.HasFlag(FileAttributes.System)) attr |= IsoNodeAttributes.System;
            if (fi.Attributes.HasFlag(FileAttributes.Archive)) attr |= IsoNodeAttributes.Archive;

            var node = new IsoNode
            {
                Name = fi.Name,
                IsDirectory = false,
                CreationTime = fi.LastWriteTime,
                Attributes = attr,
                Parent = parentDir,
                SourceLocalFilePath = fi.FullName,
                Size = fi.Length
            };
            parentDir.Children.Add(node);
            IsDirty = true;
            return node;
        }

        public void AddLocalDirectoryRecursive(IsoNode parentDir, string localDirPath)
        {
            var di = new DirectoryInfo(localDirPath);
            if (!di.Exists) return;

            var subNode = AddFolder(parentDir, di.Name);
            foreach (var file in di.GetFiles())
            {
                AddLocalFile(subNode, file.FullName);
            }
            foreach (var subDir in di.GetDirectories())
            {
                AddLocalDirectoryRecursive(subNode, subDir.FullName);
            }
            IsDirty = true;
        }

        public void ExtractNodeToDisk(IsoNode node, string targetDirectory)
        {
            Directory.CreateDirectory(targetDirectory);
            if (node.IsDirectory)
            {
                string destSub = Path.Combine(targetDirectory, SanitizeFileName(node.Name));
                Directory.CreateDirectory(destSub);
                foreach (var child in node.Children)
                {
                    ExtractNodeToDisk(child, destSub);
                }
            }
            else
            {
                string destFile = Path.Combine(targetDirectory, SanitizeFileName(node.Name));
                using var src = node.OpenReadStream();
                using var dst = new FileStream(destFile, FileMode.Create, FileAccess.Write, FileShare.None);
                src.CopyTo(dst);

                var fa = FileAttributes.Normal;
                if (node.Attributes.HasFlag(IsoNodeAttributes.Hidden)) fa |= FileAttributes.Hidden;
                if (node.Attributes.HasFlag(IsoNodeAttributes.ReadOnly)) fa |= FileAttributes.ReadOnly;
                if (node.Attributes.HasFlag(IsoNodeAttributes.System)) fa |= FileAttributes.System;
                if (node.Attributes.HasFlag(IsoNodeAttributes.Archive)) fa |= FileAttributes.Archive;
                try { File.SetAttributes(destFile, fa); } catch { }
            }
        }

        private static string SanitizeFileName(string name)
        {
            foreach (var c in Path.GetInvalidFileNameChars())
                name = name.Replace(c, '_');
            return string.IsNullOrWhiteSpace(name) ? "unnamed" : name;
        }

        public long GetEstimatedIsoSizeBytes()
        {
            long baseOverhead = 36 * 2048L; // System area + Volume Descriptors + Path tables
            if (IsBootable && BootImageData != null)
                baseOverhead += ((BootImageData.Length + 2047) / 2048) * 2048L + 2048L;
            return baseOverhead + Root.ComputeTotalBytes();
        }
    }
}
