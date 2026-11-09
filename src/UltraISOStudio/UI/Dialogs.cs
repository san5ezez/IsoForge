using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using UltraISOStudio.Core;
using UltraISOStudio.Services;

namespace UltraISOStudio.UI
{
    /// <summary>
    /// 1. Файл -> Свойства (File -> Properties):
    /// Задает файловую систему образа (ISO 9660, Joliet, UDF), длинные имена файлов и поддержку файлов > 4 ГБ.
    /// </summary>
    public class PropertiesDialog : Form
    {
        private readonly IsoProjectProperties _props;
        private TextBox _txtVolumeLabel = null!;
        private TextBox _txtSystemId = null!;
        private TextBox _txtPublisher = null!;
        private TextBox _txtAppId = null!;
        private CheckBox _chkIso9660 = null!;
        private CheckBox _chkJoliet = null!;
        private CheckBox _chkUdf = null!;
        private CheckBox _chkLongNames = null!;
        private CheckBox _chkOver4Gb = null!;
        private CheckBox _chkOmitVersion = null!;

        public PropertiesDialog(IsoProjectProperties props)
        {
            _props = props;
            Text = "Свойства проекта ISO-образа";
            Size = new Size(520, 440);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterParent;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Segoe UI", 9f);

            var grpFs = new GroupBox
            {
                Text = "Файловая система образа (ISO 9660 / Joliet / UDF)",
                Location = new Point(14, 12),
                Size = new Size(476, 175)
            };

            _chkIso9660 = new CheckBox
            {
                Text = "ISO 9660 (Базовый стандарт совместимости DOS/Windows/Linux)",
                Location = new Point(16, 26),
                Size = new Size(440, 24),
                Checked = _props.FileSystem.HasFlag(IsoFileSystemType.Iso9660)
            };

            _chkJoliet = new CheckBox
            {
                Text = "Joliet (Расширение Unicode UCS-2 для длинных и русских имен файлов)",
                Location = new Point(16, 54),
                Size = new Size(440, 24),
                Checked = _props.FileSystem.HasFlag(IsoFileSystemType.Joliet)
            };

            _chkUdf = new CheckBox
            {
                Text = "UDF (Universal Disk Format — поддержка DVD/Blu-Ray и файлов > 4 ГБ)",
                Location = new Point(16, 82),
                Size = new Size(440, 24),
                Checked = _props.FileSystem.HasFlag(IsoFileSystemType.Udf)
            };

            _chkLongNames = new CheckBox
            {
                Text = "Разрешать длинные имена файлов (до 103/255 символов)",
                Location = new Point(16, 112),
                Size = new Size(440, 24),
                Checked = _props.AllowLongFileNames
            };

            _chkOver4Gb = new CheckBox
            {
                Text = "Разрешать файлы размером более 4 ГБ (требуется UDF Bridge)",
                Location = new Point(16, 140),
                Size = new Size(440, 24),
                Checked = _props.AllowFilesOver4GB
            };
            _chkUdf.CheckedChanged += (_, _) =>
            {
                if (_chkUdf.Checked) _chkOver4Gb.Checked = true;
            };

            grpFs.Controls.AddRange(new Control[] { _chkIso9660, _chkJoliet, _chkUdf, _chkLongNames, _chkOver4Gb });

            var grpMeta = new GroupBox
            {
                Text = "Метка тома и идентификаторы образа",
                Location = new Point(14, 195),
                Size = new Size(476, 150)
            };

            grpMeta.Controls.Add(new Label { Text = "Метка тома (Volume Label):", Location = new Point(16, 28), Size = new Size(170, 22) });
            _txtVolumeLabel = new TextBox { Text = _props.VolumeLabel, Location = new Point(195, 25), Size = new Size(260, 24) };

            grpMeta.Controls.Add(new Label { Text = "Система (System ID):", Location = new Point(16, 58), Size = new Size(170, 22) });
            _txtSystemId = new TextBox { Text = _props.SystemIdentifier, Location = new Point(195, 55), Size = new Size(260, 24) };

            grpMeta.Controls.Add(new Label { Text = "Издатель (Publisher):", Location = new Point(16, 88), Size = new Size(170, 22) });
            _txtPublisher = new TextBox { Text = _props.Publisher, Location = new Point(195, 85), Size = new Size(260, 24) };

            _chkOmitVersion = new CheckBox
            {
                Text = "Не добавлять номер версии (;1) к именам файлов ISO 9660",
                Location = new Point(16, 118),
                Size = new Size(440, 22),
                Checked = _props.OmitVersionNumbers
            };
            _txtAppId = new TextBox { Text = _props.ApplicationIdentifier, Visible = false };
            grpMeta.Controls.AddRange(new Control[] { _txtVolumeLabel, _txtSystemId, _txtPublisher, _chkOmitVersion });

            var btnOk = new Button { Text = "ОК (Сохранить)", DialogResult = DialogResult.OK, Location = new Point(280, 358), Size = new Size(110, 32) };
            var btnCancel = new Button { Text = "Отмена", DialogResult = DialogResult.Cancel, Location = new Point(398, 358), Size = new Size(92, 32) };

            btnOk.Click += (_, _) =>
            {
                IsoFileSystemType fs = IsoFileSystemType.Iso9660;
                if (_chkJoliet.Checked) fs |= IsoFileSystemType.Joliet;
                if (_chkUdf.Checked || _chkOver4Gb.Checked) fs |= IsoFileSystemType.Udf;

                _props.FileSystem = fs;
                _props.AllowLongFileNames = _chkLongNames.Checked;
                _props.AllowFilesOver4GB = _chkOver4Gb.Checked;
                _props.OmitVersionNumbers = _chkOmitVersion.Checked;
                _props.VolumeLabel = string.IsNullOrWhiteSpace(_txtVolumeLabel.Text) ? "ULTRAISO_DISC" : _txtVolumeLabel.Text.Trim();
                _props.SystemIdentifier = _txtSystemId.Text.Trim();
                _props.Publisher = _txtPublisher.Text.Trim();
            };

            Controls.AddRange(new Control[] { grpFs, grpMeta, btnOk, btnCancel });
            AcceptButton = btnOk;
            CancelButton = btnCancel;
        }
    }

    /// <summary>
    /// 2. Действие -> Изменить атрибуты файла/папки внутри ISO (Скрытый, Только чтение, Системный, Архивный).
    /// </summary>
    public class NodeAttributesDialog : Form
    {
        private readonly IsoNode _node;
        private CheckBox _chkHidden = null!;
        private CheckBox _chkReadOnly = null!;
        private CheckBox _chkSystem = null!;
        private CheckBox _chkArchive = null!;
        private DateTimePicker _dtPicker = null!;

        public NodeAttributesDialog(IsoNode node)
        {
            _node = node;
            Text = $"Атрибуты объекта: {node.Name}";
            Size = new Size(400, 285);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterParent;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Segoe UI", 9f);

            var grp = new GroupBox
            {
                Text = "Атрибуты элемента внутри ISO-образа",
                Location = new Point(14, 12),
                Size = new Size(356, 185)
            };

            _chkHidden = new CheckBox
            {
                Text = "Скрытый (Hidden — скрыть файл внутри образа)",
                Location = new Point(16, 28),
                Size = new Size(320, 24),
                Checked = _node.Attributes.HasFlag(IsoNodeAttributes.Hidden)
            };
            _chkReadOnly = new CheckBox
            {
                Text = "Только чтение (Read-Only)",
                Location = new Point(16, 56),
                Size = new Size(320, 24),
                Checked = _node.Attributes.HasFlag(IsoNodeAttributes.ReadOnly)
            };
            _chkSystem = new CheckBox
            {
                Text = "Системный (System)",
                Location = new Point(16, 84),
                Size = new Size(320, 24),
                Checked = _node.Attributes.HasFlag(IsoNodeAttributes.System)
            };
            _chkArchive = new CheckBox
            {
                Text = "Архивный (Archive)",
                Location = new Point(16, 112),
                Size = new Size(320, 24),
                Checked = _node.Attributes.HasFlag(IsoNodeAttributes.Archive)
            };

            grp.Controls.Add(new Label { Text = "Дата/время:", Location = new Point(16, 146), Size = new Size(90, 22) });
            _dtPicker = new DateTimePicker
            {
                Format = DateTimePickerFormat.Custom,
                CustomFormat = "yyyy-MM-dd HH:mm:ss",
                Value = _node.CreationTime < new DateTime(1980, 1, 1) ? DateTime.Now : _node.CreationTime,
                Location = new Point(110, 142),
                Size = new Size(220, 24)
            };

            grp.Controls.AddRange(new Control[] { _chkHidden, _chkReadOnly, _chkSystem, _chkArchive, _dtPicker });

            var btnOk = new Button { Text = "Применить", DialogResult = DialogResult.OK, Location = new Point(176, 208), Size = new Size(95, 30) };
            var btnCancel = new Button { Text = "Отмена", DialogResult = DialogResult.Cancel, Location = new Point(278, 208), Size = new Size(92, 30) };

            btnOk.Click += (_, _) =>
            {
                IsoNodeAttributes attr = IsoNodeAttributes.Normal;
                if (_chkHidden.Checked) attr |= IsoNodeAttributes.Hidden;
                if (_chkReadOnly.Checked) attr |= IsoNodeAttributes.ReadOnly;
                if (_chkSystem.Checked) attr |= IsoNodeAttributes.System;
                if (_chkArchive.Checked) attr |= IsoNodeAttributes.Archive;
                _node.Attributes = attr;
                _node.CreationTime = _dtPicker.Value;
            };

            Controls.AddRange(new Control[] { grp, btnOk, btnCancel });
            AcceptButton = btnOk;
            CancelButton = btnCancel;
        }
    }

    /// <summary>
    /// 3. Самозагрузка -> Записать образ Жесткого диска (Write Disk Image to USB):
    /// Открывает окно для записи ISO-образа на USB-флешку (USB-HDD+, USB-ZIP+, USB-HDD, USB-ZIP).
    /// </summary>
    public class WriteDiskImageDialog : Form
    {
        private readonly IsoProject _project;
        private ComboBox _cmbDrives = null!;
        private ComboBox _cmbMethod = null!;
        private TextBox _txtSourceIso = null!;
        private ProgressBar _progressBar = null!;
        private Label _lblStatus = null!;
        private Button _btnWrite = null!;

        public WriteDiskImageDialog(IsoProject project)
        {
            _project = project;
            Text = "Записать образ Жесткого диска (Write Disk Image — USB-флешка)";
            Size = new Size(560, 395);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterParent;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Segoe UI", 9f);

            var grp = new GroupBox
            {
                Text = "Параметры записи загрузочного образа на USB-накопитель",
                Location = new Point(14, 12),
                Size = new Size(518, 235)
            };

            grp.Controls.Add(new Label { Text = "Диск (Drive / USB-флешка):", Location = new Point(16, 30), Size = new Size(175, 22) });
            _cmbDrives = new ComboBox { Location = new Point(195, 27), Size = new Size(235, 24), DropDownStyle = ComboBoxStyle.DropDownList };
            var btnRefresh = new Button { Text = "Обновить", Location = new Point(436, 26), Size = new Size(68, 26) };
            btnRefresh.Click += (_, _) => PopulateDrives();

            grp.Controls.Add(new Label { Text = "Файл образа:", Location = new Point(16, 66), Size = new Size(175, 22) });
            _txtSourceIso = new TextBox
            {
                Text = _project.CurrentFilePath ?? $"[Текущий проект в памяти: {_project.Properties.VolumeLabel}]",
                ReadOnly = true,
                Location = new Point(195, 63),
                Size = new Size(309, 24)
            };

            grp.Controls.Add(new Label { Text = "Статус загрузчика:", Location = new Point(16, 102), Size = new Size(175, 22) });
            var lblBootState = new Label
            {
                Text = _project.IsBootable
                    ? $"Самозагружаемый (El Torito: {_project.BootImageName}, {_project.BootImageData?.Length ?? 0} байт)"
                    : "Обычный образ (можно добавить boot-файл через меню Самозагрузка)",
                ForeColor = _project.IsBootable ? Color.FromArgb(25, 135, 84) : Color.FromArgb(180, 110, 0),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Location = new Point(195, 102),
                Size = new Size(309, 22)
            };
            grp.Controls.Add(lblBootState);

            grp.Controls.Add(new Label { Text = "Метод записи (Write Method):", Location = new Point(16, 138), Size = new Size(175, 22) });
            _cmbMethod = new ComboBox { Location = new Point(195, 135), Size = new Size(235, 24), DropDownStyle = ComboBoxStyle.DropDownList };
            _cmbMethod.Items.AddRange(new object[] { "USB-HDD+ (Рекомендуется)", "USB-HDD", "USB-ZIP+", "USB-ZIP", "RAW Sector Image (.img)" });
            _cmbMethod.SelectedIndex = 0;

            var lblWarn = new Label
            {
                Text = "Внимание: при записи на выбранный USB-носитель файлы образа будут развернуты в корень накопителя вместе с загрузочным сектором.",
                ForeColor = Color.FromArgb(150, 50, 40),
                Location = new Point(16, 178),
                Size = new Size(488, 42)
            };
            grp.Controls.AddRange(new Control[] { _cmbDrives, btnRefresh, _txtSourceIso, _cmbMethod, lblWarn });

            _progressBar = new ProgressBar { Location = new Point(14, 260), Size = new Size(518, 22) };
            _lblStatus = new Label { Text = "Готов к записи.", Location = new Point(14, 288), Size = new Size(518, 22) };

            _btnWrite = new Button { Text = "Записать (Write)", Location = new Point(308, 316), Size = new Size(115, 32) };
            var btnClose = new Button { Text = "Закрыть", DialogResult = DialogResult.Cancel, Location = new Point(430, 316), Size = new Size(102, 32) };

            _btnWrite.Click += async (_, _) => await ExecuteWriteAsync();

            Controls.AddRange(new Control[] { grp, _progressBar, _lblStatus, _btnWrite, btnClose });
            PopulateDrives();
        }

        private void PopulateDrives()
        {
            _cmbDrives.Items.Clear();
            var drives = WindowsDiskService.GetRemovableAndUsbDrives();
            foreach (var d in drives)
                _cmbDrives.Items.Add(d);

            _cmbDrives.Items.Add("[Сохранить в файл образа USB-диска (.img)...]");
            _cmbDrives.SelectedIndex = 0;
        }

        private async Task ExecuteWriteAsync()
        {
            string method = _cmbMethod.SelectedItem?.ToString() ?? "USB-HDD+";
            string targetPath;

            if (_cmbDrives.SelectedItem is DriveTargetInfo dti)
            {
                var confirm = MessageBox.Show(
                    $"Вы уверены, что хотите записать образ '{_project.Properties.VolumeLabel}' на накопитель {dti.DisplayTitle} методом {method}?",
                    "Подтверждение записи на USB",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);
                if (confirm != DialogResult.Yes) return;
                targetPath = dti.DriveLetter;
            }
            else
            {
                using var sfd = new SaveFileDialog
                {
                    Title = "Сохранить посекторный образ USB-диска",
                    Filter = "Образ USB/HDD диска (*.img;*.raw)|*.img;*.raw|ISO образ (*.iso)|*.iso",
                    FileName = $"{_project.Properties.VolumeLabel}_usb.img"
                };
                if (sfd.ShowDialog(this) != DialogResult.OK) return;
                targetPath = sfd.FileName;
            }

            _btnWrite.Enabled = false;
            try
            {
                await Task.Run(() =>
                {
                    WindowsDiskService.WriteDiskImageToUsbOrTarget(
                        _project,
                        _project.CurrentFilePath,
                        targetPath,
                        method,
                        (pct, msg) =>
                        {
                            BeginInvoke(new Action(() =>
                            {
                                _progressBar.Value = Math.Clamp(pct, 0, 100);
                                _lblStatus.Text = msg;
                            }));
                        });
                });

                MessageBox.Show(
                    $"Запись образа на '{targetPath}' методом {method} успешно завершена!",
                    "Запись завершена",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка записи: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                _btnWrite.Enabled = true;
            }
        }
    }

    /// <summary>
    /// 4. Инструменты -> Конвертер форматов (MDF, NRG, IMG, BIN, ISZ -> ISO) и Сжатие в ISZ.
    /// </summary>
    public class FormatConverterDialog : Form
    {
        private TextBox _txtInput = null!;
        private TextBox _txtOutput = null!;
        private RadioButton _rbToIso = null!;
        private RadioButton _rbToIsz = null!;
        private ProgressBar _progress = null!;
        private Label _lblStatus = null!;

        public FormatConverterDialog(string? initialSourceFile = null, bool defaultToIsz = false)
        {
            Text = defaultToIsz ? "Сжать/распаковать образ ISZ" : "Конвертер форматов образов (MDF, NRG, IMG, BIN, ISZ -> ISO)";
            Size = new Size(560, 320);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterParent;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Segoe UI", 9f);

            Controls.Add(new Label { Text = "Исходный файл образа:", Location = new Point(16, 20), Size = new Size(165, 22) });
            _txtInput = new TextBox { Text = initialSourceFile ?? "", Location = new Point(185, 17), Size = new Size(275, 24) };
            var btnBrowseIn = new Button { Text = "Обзор...", Location = new Point(466, 16), Size = new Size(68, 26) };

            Controls.Add(new Label { Text = "Выходной файл:", Location = new Point(16, 56), Size = new Size(165, 22) });
            _txtOutput = new TextBox { Location = new Point(185, 53), Size = new Size(275, 24) };
            var btnBrowseOut = new Button { Text = "Обзор...", Location = new Point(466, 52), Size = new Size(68, 26) };

            var grpMode = new GroupBox
            {
                Text = "Режим преобразования",
                Location = new Point(16, 92),
                Size = new Size(518, 86)
            };

            _rbToIso = new RadioButton
            {
                Text = "Конвертировать в стандартный ISO (из MDF, NRG, IMG, BIN, ISZ)",
                Location = new Point(16, 24),
                Size = new Size(480, 24),
                Checked = !defaultToIsz
            };
            _rbToIsz = new RadioButton
            {
                Text = "Сжать образ в формат .ISZ (Compressed ISO с ZLIB-индексом)",
                Location = new Point(16, 52),
                Size = new Size(480, 24),
                Checked = defaultToIsz
            };
            grpMode.Controls.AddRange(new Control[] { _rbToIso, _rbToIsz });

            if (!string.IsNullOrEmpty(initialSourceFile))
            {
                _txtOutput.Text = Path.ChangeExtension(initialSourceFile, defaultToIsz ? ".isz" : ".iso");
            }

            btnBrowseIn.Click += (_, _) =>
            {
                using var ofd = new OpenFileDialog
                {
                    Title = "Выберите исходный образ диска",
                    Filter = "Все образы дисков (*.mdf;*.nrg;*.img;*.bin;*.isz;*.iso)|*.mdf;*.nrg;*.img;*.bin;*.isz;*.iso|Все файлы (*.*)|*.*"
                };
                if (ofd.ShowDialog(this) == DialogResult.OK)
                {
                    _txtInput.Text = ofd.FileName;
                    _txtOutput.Text = Path.ChangeExtension(ofd.FileName, _rbToIsz.Checked ? ".isz" : ".iso");
                    if (string.Equals(_txtInput.Text, _txtOutput.Text, StringComparison.OrdinalIgnoreCase))
                        _txtOutput.Text = Path.Combine(Path.GetDirectoryName(ofd.FileName) ?? "", Path.GetFileNameWithoutExtension(ofd.FileName) + "_converted.iso");
                }
            };

            btnBrowseOut.Click += (_, _) =>
            {
                using var sfd = new SaveFileDialog
                {
                    Title = "Укажите выходной файл",
                    Filter = _rbToIsz.Checked ? "Сжатый образ ISZ (*.isz)|*.isz" : "Стандартный образ ISO (*.iso)|*.iso",
                    FileName = _txtOutput.Text
                };
                if (sfd.ShowDialog(this) == DialogResult.OK)
                    _txtOutput.Text = sfd.FileName;
            };

            _progress = new ProgressBar { Location = new Point(16, 190), Size = new Size(518, 22) };
            _lblStatus = new Label { Text = "Ожидание запуска...", Location = new Point(16, 216), Size = new Size(518, 22) };

            var btnConvert = new Button { Text = "Конвертировать", Location = new Point(314, 242), Size = new Size(118, 32) };
            var btnCancel = new Button { Text = "Закрыть", DialogResult = DialogResult.Cancel, Location = new Point(438, 242), Size = new Size(96, 32) };

            btnConvert.Click += async (_, _) =>
            {
                if (!File.Exists(_txtInput.Text))
                {
                    MessageBox.Show("Укажите существующий исходный файл образа.", "Внимание", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                if (string.IsNullOrWhiteSpace(_txtOutput.Text))
                {
                    MessageBox.Show("Укажите путь для сохранения выходного файла.", "Внимание", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }

                btnConvert.Enabled = false;
                string inPath = _txtInput.Text;
                string outPath = _txtOutput.Text;
                bool toIsz = _rbToIsz.Checked;

                try
                {
                    await Task.Run(() =>
                    {
                        if (toIsz)
                        {
                            ImageFormatService.CompressIsoToIsz(inPath, outPath, 6, (pct, msg) =>
                            {
                                BeginInvoke(new Action(() =>
                                {
                                    _progress.Value = Math.Clamp(pct, 0, 100);
                                    _lblStatus.Text = msg;
                                }));
                            });
                        }
                        else
                        {
                            ImageFormatService.ConvertToStandardIso(inPath, outPath, (pct, msg) =>
                            {
                                BeginInvoke(new Action(() =>
                                {
                                    _progress.Value = Math.Clamp(pct, 0, 100);
                                    _lblStatus.Text = msg;
                                }));
                            });
                        }
                    });

                    MessageBox.Show($"Файл успешно сконвертирован:\n{outPath}", "Готово", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Ошибка конвертации: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                finally
                {
                    btnConvert.Enabled = true;
                }
            };

            Controls.AddRange(new Control[] { _txtInput, btnBrowseIn, _txtOutput, btnBrowseOut, grpMode, _progress, _lblStatus, btnConvert, btnCancel });
        }
    }

    /// <summary>
    /// 5. Инструменты -> Проверка контрольных сумм файлов (CRC32, MD5, SHA-1, SHA-256).
    /// </summary>
    public class ChecksumDialog : Form
    {
        private TextBox _txtFile = null!;
        private TextBox _txtCrc32 = null!;
        private TextBox _txtMd5 = null!;
        private TextBox _txtSha1 = null!;
        private TextBox _txtSha256 = null!;
        private ProgressBar _progress = null!;

        public ChecksumDialog(string? initialFile = null)
        {
            Text = "Проверка контрольных сумм файлов (CRC32 / MD5 / SHA-1 / SHA-256)";
            Size = new Size(580, 315);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterParent;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Segoe UI", 9f);

            Controls.Add(new Label { Text = "Файл для проверки:", Location = new Point(16, 18), Size = new Size(135, 22) });
            _txtFile = new TextBox { Text = initialFile ?? "", Location = new Point(155, 15), Size = new Size(320, 24) };
            var btnBrowse = new Button { Text = "Обзор...", Location = new Point(482, 14), Size = new Size(68, 26) };

            Controls.Add(new Label { Text = "CRC32:", Location = new Point(16, 58), Size = new Size(135, 22) });
            _txtCrc32 = new TextBox { ReadOnly = true, Location = new Point(155, 55), Size = new Size(395, 24), Font = new Font("Consolas", 9.5f) };

            Controls.Add(new Label { Text = "MD5:", Location = new Point(16, 92), Size = new Size(135, 22) });
            _txtMd5 = new TextBox { ReadOnly = true, Location = new Point(155, 89), Size = new Size(395, 24), Font = new Font("Consolas", 9.5f) };

            Controls.Add(new Label { Text = "SHA-1:", Location = new Point(16, 126), Size = new Size(135, 22) });
            _txtSha1 = new TextBox { ReadOnly = true, Location = new Point(155, 123), Size = new Size(395, 24), Font = new Font("Consolas", 9.5f) };

            Controls.Add(new Label { Text = "SHA-256:", Location = new Point(16, 160), Size = new Size(135, 22) });
            _txtSha256 = new TextBox { ReadOnly = true, Location = new Point(155, 157), Size = new Size(395, 24), Font = new Font("Consolas", 9.5f) };

            _progress = new ProgressBar { Location = new Point(16, 198), Size = new Size(534, 20) };

            var btnCalc = new Button { Text = "Вычислить суммы", Location = new Point(210, 230), Size = new Size(130, 32) };
            var btnCopy = new Button { Text = "Копировать отчет", Location = new Point(346, 230), Size = new Size(115, 32) };
            var btnClose = new Button { Text = "Закрыть", DialogResult = DialogResult.Cancel, Location = new Point(467, 230), Size = new Size(83, 32) };

            btnBrowse.Click += (_, _) =>
            {
                using var ofd = new OpenFileDialog { Title = "Выберите файл для расчета контрольных сумм", Filter = "Все файлы (*.*)|*.*" };
                if (ofd.ShowDialog(this) == DialogResult.OK)
                    _txtFile.Text = ofd.FileName;
            };

            btnCalc.Click += async (_, _) =>
            {
                if (!File.Exists(_txtFile.Text))
                {
                    MessageBox.Show("Выберите существующий файл на диске.", "Внимание", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                btnCalc.Enabled = false;
                string path = _txtFile.Text;
                try
                {
                    var rep = await Task.Run(() => ImageFormatService.ComputeChecksums(path, pct =>
                    {
                        BeginInvoke(new Action(() => _progress.Value = Math.Clamp(pct, 0, 100)));
                    }));
                    _txtCrc32.Text = rep.Crc32;
                    _txtMd5.Text = rep.Md5;
                    _txtSha1.Text = rep.Sha1;
                    _txtSha256.Text = rep.Sha256;
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Ошибка чтения файла: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
                finally
                {
                    btnCalc.Enabled = true;
                }
            };

            btnCopy.Click += (_, _) =>
            {
                if (!string.IsNullOrEmpty(_txtSha256.Text))
                {
                    string summary = $"Файл: {_txtFile.Text}\r\nCRC32: {_txtCrc32.Text}\r\nMD5: {_txtMd5.Text}\r\nSHA-1: {_txtSha1.Text}\r\nSHA-256: {_txtSha256.Text}";
                    Clipboard.SetText(summary);
                    MessageBox.Show("Контрольные суммы скопированы в буфер обмена.", "Скопировано", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
            };

            Controls.AddRange(new Control[] { _txtFile, btnBrowse, _txtCrc32, _txtMd5, _txtSha1, _txtSha256, _progress, btnCalc, btnCopy, btnClose });
        }
    }

    /// <summary>
    /// 6. Опции -> Настройки (ISODrive виртуальный привод, ассоциации файлов, интеграция в контекстное меню Windows).
    /// </summary>
    public class OptionsDialog : Form
    {
        private readonly AppSettings _settings;
        private ComboBox _cmbDriveLetter = null!;
        private NumericUpDown _numDrives = null!;
        private CheckBox _chkAutoMount = null!;
        private CheckBox _chkIso = null!;
        private CheckBox _chkIsz = null!;
        private CheckBox _chkOtherFormats = null!;
        private CheckBox _chkContextMenu = null!;

        public OptionsDialog(AppSettings settings)
        {
            _settings = settings;
            Text = "Опции и Настройки программы (Options -> Configuration)";
            Size = new Size(510, 385);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterParent;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Segoe UI", 9f);

            var grpIsoDrive = new GroupBox
            {
                Text = "Виртуальный привод (ISODrive)",
                Location = new Point(14, 12),
                Size = new Size(466, 125)
            };

            grpIsoDrive.Controls.Add(new Label { Text = "Количество виртуальных приводов:", Location = new Point(16, 28), Size = new Size(220, 22) });
            _numDrives = new NumericUpDown { Minimum = 1, Maximum = 8, Value = _settings.NumberOfVirtualDrives, Location = new Point(245, 25), Size = new Size(70, 24) };

            grpIsoDrive.Controls.Add(new Label { Text = "Буква виртуального привода:", Location = new Point(16, 60), Size = new Size(220, 22) });
            _cmbDriveLetter = new ComboBox { Location = new Point(245, 57), Size = new Size(70, 24), DropDownStyle = ComboBoxStyle.DropDownList };
            for (char c = 'G'; c <= 'Z'; c++)
                _cmbDriveLetter.Items.Add($"{c}:");
            _cmbDriveLetter.SelectedItem = $"{_settings.PreferredVirtualDriveLetter}:";

            _chkAutoMount = new CheckBox
            {
                Text = "Автоматически монтировать образ при открытии (ISODrive)",
                Location = new Point(16, 92),
                Size = new Size(430, 24),
                Checked = _settings.AutoMountOnDoubleClick
            };
            grpIsoDrive.Controls.AddRange(new Control[] { _numDrives, _cmbDriveLetter, _chkAutoMount });

            var grpShell = new GroupBox
            {
                Text = "Ассоциации файлов и интеграция с Проводником Windows",
                Location = new Point(14, 146),
                Size = new Size(466, 145)
            };

            _chkIso = new CheckBox { Text = "Ассоциировать файлы .ISO с UltraISO Studio", Location = new Point(16, 26), Size = new Size(420, 24), Checked = _settings.AssociateIso };
            _chkIsz = new CheckBox { Text = "Ассоциировать сжатые образы .ISZ", Location = new Point(16, 54), Size = new Size(420, 24), Checked = _settings.AssociateIsz };
            _chkOtherFormats = new CheckBox { Text = "Ассоциировать образы .MDF, .NRG, .IMG, .BIN", Location = new Point(16, 82), Size = new Size(420, 24), Checked = _settings.AssociateBinNrgMdf };
            _chkContextMenu = new CheckBox
            {
                Text = "Интегрировать в контекстное меню Windows (монтирование по ПКМ)",
                Location = new Point(16, 110),
                Size = new Size(440, 24),
                Checked = _settings.EnableWindowsContextMenu
            };
            grpShell.Controls.AddRange(new Control[] { _chkIso, _chkIsz, _chkOtherFormats, _chkContextMenu });

            var btnApply = new Button { Text = "Применить в Windows", DialogResult = DialogResult.OK, Location = new Point(232, 304), Size = new Size(150, 32) };
            var btnCancel = new Button { Text = "Отмена", DialogResult = DialogResult.Cancel, Location = new Point(388, 304), Size = new Size(92, 32) };

            btnApply.Click += (_, _) =>
            {
                _settings.NumberOfVirtualDrives = (int)_numDrives.Value;
                if (_cmbDriveLetter.SelectedItem is string s && s.Length > 0)
                    _settings.PreferredVirtualDriveLetter = s[0];
                _settings.AutoMountOnDoubleClick = _chkAutoMount.Checked;
                _settings.AssociateIso = _chkIso.Checked;
                _settings.AssociateIsz = _chkIsz.Checked;
                _settings.AssociateBinNrgMdf = _chkOtherFormats.Checked;
                _settings.EnableWindowsContextMenu = _chkContextMenu.Checked;

                string res = WindowsDiskService.ApplyWindowsShellIntegration(_settings);
                MessageBox.Show(res, "Настройки сохранены", MessageBoxButtons.OK, MessageBoxIcon.Information);
            };

            Controls.AddRange(new Control[] { grpIsoDrive, grpShell, btnApply, btnCancel });
            AcceptButton = btnApply;
            CancelButton = btnCancel;
        }
    }

    /// <summary>
    /// Simple prompt dialog for creating a new folder or renaming a file/folder inside the ISO image.
    /// </summary>
    public class TextPromptDialog : Form
    {
        public string InputValue { get; private set; } = string.Empty;
        private readonly TextBox _txtInput;

        public TextPromptDialog(string title, string labelText, string defaultValue = "")
        {
            Text = title;
            Size = new Size(410, 165);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterParent;
            MaximizeBox = false;
            MinimizeBox = false;
            Font = new Font("Segoe UI", 9f);

            Controls.Add(new Label { Text = labelText, Location = new Point(14, 16), Size = new Size(365, 22) });
            _txtInput = new TextBox { Text = defaultValue, Location = new Point(14, 42), Size = new Size(365, 25) };

            var btnOk = new Button { Text = "ОК", DialogResult = DialogResult.OK, Location = new Point(200, 80), Size = new Size(85, 30) };
            var btnCancel = new Button { Text = "Отмена", DialogResult = DialogResult.Cancel, Location = new Point(294, 80), Size = new Size(85, 30) };

            btnOk.Click += (_, _) => InputValue = _txtInput.Text.Trim();

            Controls.AddRange(new Control[] { _txtInput, btnOk, btnCancel });
            AcceptButton = btnOk;
            CancelButton = btnCancel;
        }
    }
}
