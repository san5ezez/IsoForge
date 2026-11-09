using System;
using System.IO;
using System.Windows.Forms;
using UltraISOStudio.Core;
using UltraISOStudio.Services;
using UltraISOStudio.UI;

namespace UltraISOStudio
{
    internal static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            // CLI / Self-test / Context-menu switches
            if (args.Length >= 1 && args[0] == "--self-test")
            {
                return RunAutomatedSelfTest();
            }

            ApplicationConfiguration.Initialize();

            if (args.Length >= 2 && args[0] == "--mount" && File.Exists(args[1]))
            {
                string res = WindowsDiskService.MountIsoImage(args[1]);
                MessageBox.Show(res, "UltraISO Studio — Монтирование ISODrive", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            }

            if (args.Length >= 2 && args[0] == "--write" && File.Exists(args[1]))
            {
                var proj = IsoEngine.LoadIsoImage(args[1]);
                using var dlg = new WriteDiskImageDialog(proj);
                dlg.ShowDialog();
                return 0;
            }

            string? startupFile = args.Length >= 1 && File.Exists(args[0]) ? args[0] : null;
            Application.Run(new MainForm(startupFile));
            return 0;
        }

        /// <summary>
        /// Automated verification test invoked during GitHub Actions CI build (--self-test)
        /// to verify ISO 9660 + Joliet + UDF + El Torito creation, parsing, ISZ compression, and checksums.
        /// </summary>
        private static int RunAutomatedSelfTest()
        {
            try
            {
                Console.WriteLine("[SelfTest] Starting UltraISO Studio x64 Core Engine verification...");
                string tempDir = Path.Combine(Path.GetTempPath(), "UltraISOTest_" + Guid.NewGuid().ToString("N")[..8]);
                Directory.CreateDirectory(tempDir);

                string sampleTxt = Path.Combine(tempDir, "Привет_Мир_Joliet_LongFileName.txt");
                File.WriteAllText(sampleTxt, "Hello from UltraISO Studio x64! Проверка русских имен Joliet и El Torito.");

                var proj = new IsoProject();
                proj.Properties.VolumeLabel = "WIN64_BOOT_ISO";
                proj.Properties.FileSystem = IsoFileSystemType.Iso9660 | IsoFileSystemType.Joliet | IsoFileSystemType.Udf;
                var subFolder = proj.AddFolder(proj.Root, "Installers");
                var addedNode = proj.AddLocalFile(subFolder, sampleTxt);
                addedNode.Attributes = IsoNodeAttributes.Hidden | IsoNodeAttributes.ReadOnly;

                // Add El Torito boot sector
                byte[] boot = new byte[2048];
                boot[510] = 0x55;
                boot[511] = 0xAA;
                proj.BootImageData = boot;

                string outIso = Path.Combine(tempDir, "test_bootable.iso");
                IsoEngine.SaveIsoImage(proj, outIso);
                Console.WriteLine($"[SelfTest] Saved ISO image: {outIso} ({new FileInfo(outIso).Length} bytes)");

                var loaded = IsoEngine.LoadIsoImage(outIso);
                if (!loaded.IsBootable || loaded.Root.Children.Count != 1)
                    throw new Exception("ISO round-trip validation failed!");

                string outIsz = Path.Combine(tempDir, "test_bootable.isz");
                ImageFormatService.CompressIsoToIsz(outIso, outIsz);
                string decompIso = Path.Combine(tempDir, "test_roundtrip.iso");
                ImageFormatService.DecompressIszToIso(outIsz, decompIso);

                var sums1 = ImageFormatService.ComputeChecksums(outIso);
                var sums2 = ImageFormatService.ComputeChecksums(decompIso);
                if (sums1.Sha256 != sums2.Sha256)
                    throw new Exception("ISZ compression/decompression SHA-256 mismatch!");

                Directory.Delete(tempDir, true);
                Console.WriteLine($"[SelfTest] SUCCESS! SHA-256: {sums1.Sha256}");
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[SelfTest] FAILED: {ex}");
                return 1;
            }
        }
    }
}
