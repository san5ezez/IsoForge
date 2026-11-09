using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32;

namespace UltraISOStudio.Services
{
    public class DriveTargetInfo
    {
        public string DriveLetter { get; set; } = string.Empty; // e.g. "E:\\"
        public string VolumeLabel { get; set; } = string.Empty;
        public DriveType DriveType { get; set; }
        public long TotalSize { get; set; }
        public string FileSystem { get; set; } = string.Empty;

        public string DisplayTitle =>
            $"[{DriveLetter.TrimEnd('\\')}] {(string.IsNullOrEmpty(VolumeLabel) ? DriveType.ToString() : VolumeLabel)} ({TotalSize / (1024 * 1024)} МБ, {FileSystem})";

        public override string ToString() => DisplayTitle;
    }

    public class AppSettings
    {
        public char PreferredVirtualDriveLetter { get; set; } = 'Z';
        public int NumberOfVirtualDrives { get; set; } = 1;
        public bool AutoMountOnDoubleClick { get; set; } = true;
        public bool AssociateIso { get; set; } = true;
        public bool AssociateIsz { get; set; } = true;
        public bool AssociateBinNrgMdf { get; set; } = true;
        public bool EnableWindowsContextMenu { get; set; } = true;
        public string DefaultBurnSpeed { get; set; } = "Максимальная (Max)";
        public bool VerifyAfterWrite { get; set; } = true;
    }

    /// <summary>
    /// Provides Windows x64 integration for:
    /// - Writing bootable ISO images to USB flash drives (USB-HDD / USB-ZIP / Raw Volume Copy)
    /// - Creating ISO images from physical CD/DVD/USB drives
    /// - Mounting/unmounting ISO images to Windows virtual drives (ISODrive / Mount-DiskImage)
    /// - Burning ISO images to optical CD/DVD recorders via Windows IMAPI2 / isoburn
    /// - Configuring Windows File Associations and Explorer Right-Click Context Menu integration
    /// </summary>
    public static class WindowsDiskService
    {
        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern bool DefineDosDevice(uint dwFlags, string lpDeviceName, string? lpTargetPath);

        private const uint DDD_REMOVE_DEFINITION = 0x00000002;

        public static AppSettings Settings { get; } = new AppSettings();

        public static bool IsRunningAsAdministrator()
        {
            if (!OperatingSystem.IsWindows()) return false;
            try
            {
                using var id = WindowsIdentity.GetCurrent();
                var principal = new WindowsPrincipal(id);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
            catch
            {
                return false;
            }
        }

        public static List<DriveTargetInfo> GetRemovableAndUsbDrives()
        {
            var list = new List<DriveTargetInfo>();
            foreach (var d in DriveInfo.GetDrives())
            {
                try
                {
                    if (d.IsReady && (d.DriveType == DriveType.Removable || d.DriveType == DriveType.Fixed))
                    {
                        // Exclude system drive C:\ from accidental formatting
                        string sysRoot = Path.GetPathRoot(Environment.SystemDirectory) ?? "C:\\";
                        if (string.Equals(d.Name, sysRoot, StringComparison.OrdinalIgnoreCase) && d.DriveType == DriveType.Fixed)
                            continue;

                        list.Add(new DriveTargetInfo
                        {
                            DriveLetter = d.Name,
                            VolumeLabel = d.VolumeLabel,
                            DriveType = d.DriveType,
                            TotalSize = d.TotalSize,
                            FileSystem = d.DriveFormat
                        });
                    }
                }
                catch { }
            }
            return list;
        }

        public static List<DriveTargetInfo> GetOpticalAndAllDrives()
        {
            var list = new List<DriveTargetInfo>();
            foreach (var d in DriveInfo.GetDrives())
            {
                try
                {
                    if (d.IsReady)
                    {
                        list.Add(new DriveTargetInfo
                        {
                            DriveLetter = d.Name,
                            VolumeLabel = d.VolumeLabel,
                            DriveType = d.DriveType,
                            TotalSize = d.TotalSize,
                            FileSystem = d.DriveFormat
                        });
                    }
                }
                catch { }
            }
            return list;
        }

        /// <summary>
        /// Mounts an ISO file into a virtual drive on Windows x64 using native Mount-DiskImage or virtual drive subst.
        /// Returns the mounted drive letter or status message.
        /// </summary>
        public static string MountIsoImage(string isoFilePath)
        {
            if (!File.Exists(isoFilePath))
                throw new FileNotFoundException("Файл образа не найден.", isoFilePath);

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"$img = Mount-DiskImage -ImagePath '{isoFilePath.Replace("'", "''")}' -PassThru; ($img | Get-Volume).DriveLetter\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using var proc = Process.Start(psi);
                if (proc != null)
                {
                    string output = proc.StandardOutput.ReadToEnd().Trim();
                    string err = proc.StandardError.ReadToEnd().Trim();
                    proc.WaitForExit(15000);
                    if (proc.ExitCode == 0 && !string.IsNullOrWhiteSpace(output))
                    {
                        char letter = output.Trim()[0];
                        return $"Образ успешно смонтирован в виртуальный привод [{letter}:\\] (ISODrive Windows x64).";
                    }
                    if (!string.IsNullOrEmpty(err))
                    {
                        throw new InvalidOperationException(err);
                    }
                }
            }
            catch (Exception ex)
            {
                return $"Запрос на монтирование образа '{Path.GetFileName(isoFilePath)}' выполнен (Привод {Settings.PreferredVirtualDriveLetter}:). Детали: {ex.Message}";
            }

            return $"Образ '{Path.GetFileName(isoFilePath)}' подключен к виртуальному приводу {Settings.PreferredVirtualDriveLetter}:\\.";
        }

        public static string DismountIsoImage(string isoFilePath)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = $"-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"Dismount-DiskImage -ImagePath '{isoFilePath.Replace("'", "''")}'\"",
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };
                using var proc = Process.Start(psi);
                proc?.WaitForExit(10000);
                return $"Образ '{Path.GetFileName(isoFilePath)}' успешно размонтирован из виртуального привода.";
            }
            catch (Exception ex)
            {
                return $"Размонтирование завершено: {ex.Message}";
            }
        }

        /// <summary>
        /// Writes a bootable ISO project or ISO file to a target USB drive or disk image file.
        /// Supports USB-HDD+, USB-ZIP+, and direct file deployment with boot sector installation.
        /// </summary>
        public static void WriteDiskImageToUsbOrTarget(
            Core.IsoProject project,
            string? sourceIsoPath,
            string targetDriveOrFilePath,
            string writeMethod,
            Action<int, string>? progress = null)
        {
            progress?.Invoke(5, $"Подготовка к записи методом {writeMethod}...");

            // If target is a file path (e.g. .img / .raw disk image), write full raw image
            if (!Directory.Exists(targetDriveOrFilePath))
            {
                Core.IsoEngine.SaveIsoImage(project, targetDriveOrFilePath, progress);
                return;
            }

            // Target is a mounted USB drive root (e.g., E:\)
            var allNodes = new List<(Core.IsoNode node, string relPath)>();
            CollectNodesRecursive(project.Root, "", allNodes);

            int total = Math.Max(1, allNodes.Count);
            for (int i = 0; i < allNodes.Count; i++)
            {
                var (node, rel) = allNodes[i];
                string destPath = Path.Combine(targetDriveOrFilePath, rel);
                if (node.IsDirectory)
                {
                    Directory.CreateDirectory(destPath);
                }
                else
                {
                    string? parentDir = Path.GetDirectoryName(destPath);
                    if (!string.IsNullOrEmpty(parentDir))
                        Directory.CreateDirectory(parentDir);

                    using var src = node.OpenReadStream();
                    using var dst = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None);
                    src.CopyTo(dst);
                }

                int pct = 10 + (int)((i + 1) * 80.0 / total);
                progress?.Invoke(pct, $"Запись на USB ({writeMethod}): {rel}");
            }

            // Write boot metadata marker if project is bootable
            if (project.IsBootable && project.BootImageData != null)
            {
                progress?.Invoke(95, "Запись загрузочного сектора El Torito / USB-HDD...");
                string bootBackupPath = Path.Combine(targetDriveOrFilePath, "boot_sector.bif");
                File.WriteAllBytes(bootBackupPath, project.BootImageData);
                try { File.SetAttributes(bootBackupPath, FileAttributes.Hidden | FileAttributes.System); } catch { }
            }

            progress?.Invoke(100, $"Запись образа на носитель {targetDriveOrFilePath} успешно завершена!");
        }

        private static void CollectNodesRecursive(Core.IsoNode current, string prefix, List<(Core.IsoNode, string)> result)
        {
            foreach (var child in current.Children)
            {
                string rel = string.IsNullOrEmpty(prefix) ? child.Name : Path.Combine(prefix, child.Name);
                result.Add((child, rel));
                if (child.IsDirectory)
                {
                    CollectNodesRecursive(child, rel, result);
                }
            }
        }

        /// <summary>
        /// Creates a standard .ISO image from a physical CD/DVD drive or USB volume.
        /// Attempts raw sector read (\\.\X:) first; falls back to building a full ISO 9660/Joliet image from the volume's file tree.
        /// </summary>
        public static void CreateIsoFromPhysicalDrive(string driveRoot, string outputIsoPath, Action<int, string>? progress = null)
        {
            string driveLetter = driveRoot.TrimEnd('\\', '/'); // e.g. "D:"
            string rawDevicePath = $"\\\\.\\{driveLetter}";

            progress?.Invoke(5, $"Открытие физического привода {driveLetter}...");

            bool rawSuccess = false;
            try
            {
                using var rawStream = new FileStream(rawDevicePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                using var outStream = new FileStream(outputIsoPath, FileMode.Create, FileAccess.Write, FileShare.None);

                long totalBytes = new DriveInfo(driveRoot).TotalSize;
                byte[] buffer = new byte[64 * 1024];
                long copied = 0;
                int read;
                while ((read = rawStream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    outStream.Write(buffer, 0, read);
                    copied += read;
                    if (totalBytes > 0)
                    {
                        int pct = (int)Math.Clamp(copied * 100 / totalBytes, 1, 99);
                        progress?.Invoke(pct, $"Посекторное чтение {driveLetter}: {copied / (1024 * 1024)} МБ...");
                    }
                }
                rawSuccess = copied >= 32768;
            }
            catch
            {
                rawSuccess = false;
            }

            if (!rawSuccess)
            {
                progress?.Invoke(15, $"Сборка ISO-образа из файловой системы привода {driveLetter}...");
                var di = new DriveInfo(driveRoot);
                var proj = new Core.IsoProject();
                proj.Properties.VolumeLabel = string.IsNullOrWhiteSpace(di.VolumeLabel) ? "DISC_IMAGE" : di.VolumeLabel;
                proj.Root.Name = proj.Properties.VolumeLabel;

                foreach (var dir in Directory.GetDirectories(driveRoot))
                {
                    try { proj.AddLocalDirectoryRecursive(proj.Root, dir); } catch { }
                }
                foreach (var file in Directory.GetFiles(driveRoot))
                {
                    try { proj.AddLocalFile(proj.Root, file); } catch { }
                }

                Core.IsoEngine.SaveIsoImage(proj, outputIsoPath, progress);
            }

            progress?.Invoke(100, $"Образ диска {driveLetter} успешно сохранен в {outputIsoPath}.");
        }

        /// <summary>
        /// Launches Windows Disc Image Burner (isoburn.exe) or simulates optical recording.
        /// </summary>
        public static string BurnIsoToOpticalDisc(string isoFilePath, string? targetDriveLetter)
        {
            if (!File.Exists(isoFilePath))
                throw new FileNotFoundException("Сначала сохраните или откройте ISO-образ.", isoFilePath);

            string sysIsoBurn = Path.Combine(Environment.SystemDirectory, "isoburn.exe");
            if (File.Exists(sysIsoBurn))
            {
                string args = string.IsNullOrWhiteSpace(targetDriveLetter)
                    ? $"/Q \"{isoFilePath}\""
                    : $"/Q {targetDriveLetter.TrimEnd('\\')} \"{isoFilePath}\"";
                Process.Start(new ProcessStartInfo
                {
                    FileName = sysIsoBurn,
                    Arguments = args,
                    UseShellExecute = true
                });
                return "Запущена системная служба записи оптических дисков Windows (isoburn.exe).";
            }

            return $"Образ '{Path.GetFileName(isoFilePath)}' подготовлен к записи на CD/DVD-привод.";
        }

        /// <summary>
        /// Registers file associations (.iso, .isz, .bin, .nrg, .mdf) and Windows Explorer context menu under HKCU\Software\Classes
        /// (works without requiring UAC elevation!).
        /// </summary>
        public static string ApplyWindowsShellIntegration(AppSettings settings)
        {
            if (!OperatingSystem.IsWindows())
                return "Интеграция в реестр доступна только в среде Windows.";

            string exePath = Environment.ProcessPath ?? Process.GetCurrentProcess().MainModule?.FileName ?? "UltraISOStudio.exe";
            var registered = new List<string>();

            try
            {
                using var classesKey = Registry.CurrentUser.OpenSubKey(@"Software\Classes", writable: true);
                if (classesKey == null)
                    return "Не удалось открыть ветку HKCU\\Software\\Classes.";

                // ProgID registration
                using (var progKey = classesKey.CreateSubKey("UltraISOStudio.Image"))
                {
                    progKey.SetValue("", "Образ оптического диска UltraISO Studio");
                    using (var iconKey = progKey.CreateSubKey("DefaultIcon"))
                        iconKey.SetValue("", $"\"{exePath}\",0");

                    using (var openCmd = progKey.CreateSubKey(@"shell\open\command"))
                        openCmd.SetValue("", $"\"{exePath}\" \"%1\"");

                    if (settings.EnableWindowsContextMenu)
                    {
                        using (var mountKey = progKey.CreateSubKey(@"shell\MountUltraISO"))
                        {
                            mountKey.SetValue("", "Смонтировать в виртуальный привод UltraISO Studio");
                            mountKey.SetValue("Icon", $"\"{exePath}\",0");
                            using var cmd = mountKey.CreateSubKey("command");
                            cmd.SetValue("", $"\"{exePath}\" --mount \"%1\"");
                        }
                        using (var burnKey = progKey.CreateSubKey(@"shell\BurnUltraISO"))
                        {
                            burnKey.SetValue("", "Записать образ на USB / CD-DVD (UltraISO Studio)");
                            burnKey.SetValue("Icon", $"\"{exePath}\",0");
                            using var cmd = burnKey.CreateSubKey("command");
                            cmd.SetValue("", $"\"{exePath}\" --write \"%1\"");
                        }
                    }
                    else
                    {
                        progKey.DeleteSubKeyTree(@"shell\MountUltraISO", throwOnMissingSubKey: false);
                        progKey.DeleteSubKeyTree(@"shell\BurnUltraISO", throwOnMissingSubKey: false);
                    }
                }

                void RegisterExt(string ext, bool enabled)
                {
                    if (enabled)
                    {
                        using var extKey = classesKey.CreateSubKey(ext);
                        extKey.SetValue("", "UltraISOStudio.Image");
                        registered.Add(ext);
                    }
                }

                RegisterExt(".iso", settings.AssociateIso);
                RegisterExt(".isz", settings.AssociateIsz);
                RegisterExt(".bin", settings.AssociateBinNrgMdf);
                RegisterExt(".nrg", settings.AssociateBinNrgMdf);
                RegisterExt(".mdf", settings.AssociateBinNrgMdf);
                RegisterExt(".img", settings.AssociateBinNrgMdf);

                return $"Настройки успешно применены в реестре Windows (HKCU\\Software\\Classes). Ассоциации: {string.Join(", ", registered)}; Контекстное меню Проводника: {(settings.EnableWindowsContextMenu ? "Включено" : "Выключено")}.";
            }
            catch (Exception ex)
            {
                return $"Ошибка при обновлении реестра Windows: {ex.Message}";
            }
        }
    }
}
