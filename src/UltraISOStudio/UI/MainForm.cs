using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using UltraISOStudio.Core;
using UltraISOStudio.Services;

namespace UltraISOStudio.UI
{
    public class MainForm : Form
    {
        private IsoProject _project = new IsoProject();
        private IsoNode _currentIsoFolder;
        private string _currentLocalPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        private bool _warnedOverCapacity = false;

        // Image lists for TreeView and ListView
        private ImageList _smallIcons = null!;

        // 4 Workspace Panes
        private TreeView _tvIsoTree = null!;       // Окно 1: Верхнее левое — Дерево образа
        private ListView _lvIsoFiles = null!;      // Окно 2: Верхнее правое — Содержимое образа
        private TreeView _tvLocalTree = null!;     // Окно 3: Нижнее левое — Дерево ПК
        private ListView _lvLocalFiles = null!;    // Окно 4: Нижнее правое — Локальные файлы

        private Label _lblIsoBanner = null!;
        private Label _lblLocalBanner = null!;

        // Status bar & capacity meter
        private StatusStrip _statusStrip = null!;
        private ToolStripStatusLabel _lblStatusPath = null!;
        private ToolStripStatusLabel _lblBootStatus = null!;
        private CapacityMeterControl _capacityMeter = null!;
        private ComboBox _cmbMediaTarget = null!;

        private const string DragFormatIsoNodes = "UltraISOStudio.IsoNodes";
        private const string DragFormatLocalPaths = "UltraISOStudio.LocalPaths";

        public MainForm(string? startupIsoPath = null)
        {
            _currentIsoFolder = _project.Root;

            Text = "UltraISO Studio x64 — [Новый проект ISO]";
            Size = new Size(1220, 780);
            MinimumSize = new Size(920, 600);
            StartPosition = FormStartPosition.CenterScreen;
            Font = new Font("Segoe UI", 9f);

            InitializeImageLists();
            var menuStrip = BuildMainMenu();
            var toolStrip = BuildToolbar();
            var workspace = BuildFourPaneWorkspace();
            var bottomBar = BuildStatusBarWithCapacityGauge();

            Controls.Add(workspace);
            Controls.Add(toolStrip);
            Controls.Add(menuStrip);
            Controls.Add(bottomBar);
            MainMenuStrip = menuStrip;

            Load += (_, _) =>
            {
                RefreshIsoTree();
                PopulateLocalDrivesTree();
                if (!string.IsNullOrEmpty(startupIsoPath) && File.Exists(startupIsoPath))
                {
                    OpenImageFile(startupIsoPath);
                }
            };
        }

        private void InitializeImageLists()
        {
            _smallIcons = new ImageList
            {
                ColorDepth = ColorDepth.Depth32Bit,
                ImageSize = new Size(16, 16)
            };
            _smallIcons.Images.Add("disc", IconFactory.CreateDiscBase(16));
            _smallIcons.Images.Add("folder", IconFactory.CreateFolderIcon(16, 0));
            _smallIcons.Images.Add("file", IconFactory.CreateFileItemIcon(16));
            _smallIcons.Images.Add("drive", IconFactory.CreateDriveItemIcon(16));
        }

        // =========================================================================
        // 1. ГЛАВНОЕ МЕНЮ (Верхняя строка: Файл, Действие, Самозагрузка, Инструменты, Опции)
        // =========================================================================
        private MenuStrip BuildMainMenu()
        {
            var menu = new MenuStrip
            {
                BackColor = Color.FromArgb(245, 247, 250),
                Font = new Font("Segoe UI", 9f)
            };

            // 1.1 Файл (File)
            var mFile = new ToolStripMenuItem("&Файл (File)");
            var miNew = new ToolStripMenuItem("Создать новый образ", IconFactory.CreateCleanSheetIcon(16), (_, _) => CreateNewProject()) { ShortcutKeys = Keys.Control | Keys.N };
            var miOpen = new ToolStripMenuItem("Открыть образ...", IconFactory.CreateFolderIcon(16), (_, _) => PromptOpenImage()) { ShortcutKeys = Keys.Control | Keys.O };
            var miSave = new ToolStripMenuItem("Сохранить", IconFactory.CreateFloppyIcon(16, false), (_, _) => SaveCurrentProject(false)) { ShortcutKeys = Keys.Control | Keys.S };
            var miSaveAs = new ToolStripMenuItem("Сохранить как...", IconFactory.CreateFloppyIcon(16, true), (_, _) => SaveCurrentProject(true)) { ShortcutKeys = Keys.Control | Keys.Shift | Keys.S };
            var miProps = new ToolStripMenuItem("Свойства проекта (ISO 9660 / Joliet / UDF)...", null, (_, _) => OpenProjectProperties()) { ShortcutKeys = Keys.Alt | Keys.Enter };
            var miExit = new ToolStripMenuItem("Выход", null, (_, _) => Close()) { ShortcutKeys = Keys.Alt | Keys.F4 };

            mFile.DropDownItems.AddRange(new ToolStripItem[]
            {
                miNew, miOpen, new ToolStripSeparator(),
                miSave, miSaveAs, new ToolStripSeparator(),
                miProps, new ToolStripSeparator(),
                miExit
            });

            // 1.2 Действие (Action)
            var mAction = new ToolStripMenuItem("&Действие (Action)");
            var miNewFolder = new ToolStripMenuItem("Новая папка внутри ISO...", IconFactory.CreateFolderIcon(16, 1), (_, _) => ActionCreateIsoFolder()) { ShortcutKeys = Keys.F7 };
            var miAddFiles = new ToolStripMenuItem("Добавить файлы с ПК в образ...", IconFactory.CreateFolderIcon(16, 1), (_, _) => ActionAddLocalFilesDialog()) { ShortcutKeys = Keys.F3 };
            var miAddDir = new ToolStripMenuItem("Добавить папку с ПК в образ...", IconFactory.CreateFolderIcon(16, 1), (_, _) => ActionAddLocalFolderDialog());
            var miExtract = new ToolStripMenuItem("Извлечь выбранное из образа...", IconFactory.CreateFolderIcon(16, -1), (_, _) => ActionExtractSelectedIsoNodes()) { ShortcutKeys = Keys.F4 };
            var miRename = new ToolStripMenuItem("Переименовать файл/папку...", null, (_, _) => ActionRenameSelectedIsoNode()) { ShortcutKeys = Keys.F2 };
            var miDelete = new ToolStripMenuItem("Удалить из образа", null, (_, _) => ActionDeleteSelectedIsoNodes()) { ShortcutKeys = Keys.Delete };
            var miAttributes = new ToolStripMenuItem("Атрибуты (Скрытый / Только чтение / Системный)...", null, (_, _) => ActionChangeAttributes()) { ShortcutKeys = Keys.Control | Keys.A };

            mAction.DropDownItems.AddRange(new ToolStripItem[]
            {
                miNewFolder, new ToolStripSeparator(),
                miAddFiles, miAddDir, miExtract, new ToolStripSeparator(),
                miRename, miDelete, new ToolStripSeparator(),
                miAttributes
            });

            // 1.3 Самозагрузка (Bootable)
            var mBoot = new ToolStripMenuItem("&Самозагрузка (Bootable)");
            var miWriteUsb = new ToolStripMenuItem("Записать образ Жесткого диска (Write Disk Image на USB)...", IconFactory.CreateDiscWithDriveIcon(16), (_, _) => OpenWriteDiskImageDialog()) { ShortcutKeys = Keys.Control | Keys.B };
            var miLoadBoot = new ToolStripMenuItem("Загрузить загрузочный файл (Load Boot File .bif/.bin/.img)...", null, (_, _) => BootLoadBootFile());
            var miExtractBoot = new ToolStripMenuItem("Извлечь загрузочный файл из образа (Extract Boot File)...", null, (_, _) => BootExtractBootFile());
            var miGenerateStdBoot = new ToolStripMenuItem("Создать стандартный загрузочный сектор El Torito (x86/x64)...", null, (_, _) => BootGenerateStandardElTorito());
            var miClearBoot = new ToolStripMenuItem("Очистить загрузочный сектор (сделать несамозагружаемым)", null, (_, _) => BootClearBootSector());

            mBoot.DropDownItems.AddRange(new ToolStripItem[]
            {
                miWriteUsb, new ToolStripSeparator(),
                miLoadBoot, miExtractBoot, miGenerateStdBoot, new ToolStripSeparator(),
                miClearBoot
            });

            // 1.4 Инструменты (Tools)
            var mTools = new ToolStripMenuItem("&Инструменты (Tools)");
            var miMount = new ToolStripMenuItem("Смонтировать в виртуальный дисковод (ISODrive)...", IconFactory.CreateDiscWithGearIcon(16), (_, _) => ToolMountVirtualDrive()) { ShortcutKeys = Keys.F6 };
            var miDismount = new ToolStripMenuItem("Размонтировать виртуальный дисковод", null, (_, _) => ToolDismountVirtualDrive());
            var miMakeIsoDrive = new ToolStripMenuItem("Создать ISO-образ с реального CD/DVD/USB привода...", IconFactory.CreateDiscWithDriveIcon(16), (_, _) => ToolCreateIsoFromDrive()) { ShortcutKeys = Keys.F8 };
            var miBurnDisc = new ToolStripMenuItem("Записать образ на CD/DVD-болванку...", IconFactory.CreateDiscWithFlameIcon(16), (_, _) => ToolBurnOpticalDisc()) { ShortcutKeys = Keys.F9 };
            var miCompressIsz = new ToolStripMenuItem("Сжать образ в формат .ISZ...", IconFactory.CreateDiscWithClampIcon(16), (_, _) => OpenConverterDialog(defaultToIsz: true));
            var miConvertFormat = new ToolStripMenuItem("Конвертер форматов (из MDF, NRG, IMG, BIN в ISO)...", IconFactory.CreateTwoDiscsIcon(16), (_, _) => OpenConverterDialog(defaultToIsz: false));
            var miChecksums = new ToolStripMenuItem("Проверка контрольных сумм файлов (CRC32 / MD5 / SHA-256)...", null, (_, _) => OpenChecksumDialog());

            mTools.DropDownItems.AddRange(new ToolStripItem[]
            {
                miMount, miDismount, new ToolStripSeparator(),
                miMakeIsoDrive, miBurnDisc, new ToolStripSeparator(),
                miCompressIsz, miConvertFormat, new ToolStripSeparator(),
                miChecksums
            });

            // 1.5 Опции (Options)
            var mOptions = new ToolStripMenuItem("&Опции (Options)");
            var miSettings = new ToolStripMenuItem("Настройки (Виртуальный привод ISODrive, Ассоциации, Контекстное меню Windows)...", IconFactory.CreateDiscWithGearIcon(16), (_, _) => OpenOptionsDialog());
            mOptions.DropDownItems.Add(miSettings);

            menu.Items.AddRange(new ToolStripItem[] { mFile, mAction, mBoot, mTools, mOptions });
            return menu;
        }

        // =========================================================================
        // 2. ПАНЕЛЬ ИНСТРУМЕНТОВ (Иконки быстрого доступа — 3 логических блока)
        // =========================================================================
        private ToolStrip BuildToolbar()
        {
            var ts = new ToolStrip
            {
                ImageScalingSize = new Size(24, 24),
                GripStyle = ToolStripGripStyle.Hidden,
                BackColor = Color.FromArgb(235, 240, 248),
                Padding = new Padding(6, 3, 6, 3)
            };

            ToolStripButton MakeBtn(string text, string tooltip, Bitmap icon, EventHandler onClick)
            {
                var btn = new ToolStripButton
                {
                    Text = text,
                    ToolTipText = tooltip,
                    Image = icon,
                    DisplayStyle = ToolStripItemDisplayStyle.ImageAndText,
                    TextImageRelation = TextImageRelation.ImageAboveText,
                    Font = new Font("Segoe UI", 8f)
                };
                btn.Click += onClick;
                return btn;
            }

            // Блок 1: Блок файлов (Создать -> Открыть -> Сохранить -> Сохранить как)
            var btnNew = MakeBtn("Создать", "Создать новый проект образа (Чистый лист)", IconFactory.CreateCleanSheetIcon(24), (_, _) => CreateNewProject());
            var btnOpen = MakeBtn("Открыть", "Открыть существующий образ ISO/ISZ/MDF/NRG/IMG (Папка)", IconFactory.CreateFolderIcon(24, 0), (_, _) => PromptOpenImage());
            var btnSave = MakeBtn("Сохранить", "Сохранить текущий ISO-образ (Дискета)", IconFactory.CreateFloppyIcon(24, false), (_, _) => SaveCurrentProject(false));
            var btnSaveAs = MakeBtn("Сохр. как", "Сохранить ISO-образ под новым именем", IconFactory.CreateFloppyIcon(24, true), (_, _) => SaveCurrentProject(true));

            // Блок 2: Блок сборки (Добавить [Папка с плюсом] -> Извлечь [Папка с минусом])
            var btnAdd = MakeBtn("Добавить", "Отправить выбранные файлы/папки с ПК в образ (Папка с плюсом)", IconFactory.CreateFolderIcon(24, 1), (_, _) => ToolbarAddSelectedFromLocalPane());
            var btnExtract = MakeBtn("Извлечь", "Вытащить выбранные файлы/папки из образа на ПК (Папка с минусом)", IconFactory.CreateFolderIcon(24, -1), (_, _) => ActionExtractSelectedIsoNodes());

            // Блок 3: Блок работы с носителями
            var btnMakeIso = MakeBtn("Сделать ISO", "Диск с дисководом: Создать ISO с вставленного физического диска/флешки", IconFactory.CreateDiscWithDriveIcon(24), (_, _) => ToolCreateIsoFromDrive());
            var btnBurn = MakeBtn("Записать CD", "Диск с огнем: Записать образ на CD/DVD-болванку", IconFactory.CreateDiscWithFlameIcon(24), (_, _) => ToolBurnOpticalDisc());
            var btnMount = MakeBtn("Привод", "Диск с шестеренкой: Смонтировать образ в виртуальный дисковод ISODrive", IconFactory.CreateDiscWithGearIcon(24), (_, _) => ToolMountVirtualDrive());
            var btnCompressIsz = MakeBtn("Сжать ISZ", "Диск с тисками: Сжать образ в формат ISZ", IconFactory.CreateDiscWithClampIcon(24), (_, _) => OpenConverterDialog(defaultToIsz: true));
            var btnConvert = MakeBtn("Конвертер", "Два диска: Конвертер форматов из MDF, NRG, IMG в ISO", IconFactory.CreateTwoDiscsIcon(24), (_, _) => OpenConverterDialog(defaultToIsz: false));

            ts.Items.AddRange(new ToolStripItem[]
            {
                btnNew, btnOpen, btnSave, btnSaveAs,
                new ToolStripSeparator(),
                btnAdd, btnExtract,
                new ToolStripSeparator(),
                btnMakeIso, btnBurn, btnMount, btnCompressIsz, btnConvert
            });

            return ts;
        }

        // =========================================================================
        // 3. РАБОЧАЯ ОБЛАСТЬ (4 Окна: Верхняя половина — ISO, Нижняя половина — ПК + Drag-and-Drop)
        // =========================================================================
        private Control BuildFourPaneWorkspace()
        {
            var mainVerticalSplit = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Horizontal,
                SplitterDistance = 310,
                SplitterWidth = 6,
                BackColor = Color.FromArgb(200, 210, 224)
            };

            // ---------------- ВЕРХНЯЯ ПОЛОВИНА (Ваш ISO-образ: Окно 1 и Окно 2) ----------------
            var topSplit = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Vertical,
                SplitterDistance = 320,
                SplitterWidth = 5
            };

            // Окно 1: Верхнее левое — Дерево образа
            var pnlTopLeft = new Panel { Dock = DockStyle.Fill };
            _lblIsoBanner = new Label
            {
                Text = " [Окно 1] Дерево образа ISO (Самзагрузка: Нет)",
                Dock = DockStyle.Top,
                Height = 24,
                TextAlign = ContentAlignment.MiddleLeft,
                BackColor = Color.FromArgb(41, 76, 122),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };
            _tvIsoTree = new TreeView
            {
                Dock = DockStyle.Fill,
                ImageList = _smallIcons,
                HideSelection = false,
                AllowDrop = true
            };
            _tvIsoTree.AfterSelect += (_, e) =>
            {
                if (e.Node?.Tag is IsoNode isoDir && isoDir.IsDirectory)
                {
                    _currentIsoFolder = isoDir;
                    RefreshIsoFilesList();
                }
            };
            pnlTopLeft.Controls.Add(_tvIsoTree);
            pnlTopLeft.Controls.Add(_lblIsoBanner);

            // Окно 2: Верхнее правое — Содержимое образа
            var pnlTopRight = new Panel { Dock = DockStyle.Fill };
            var lblTopRightHeader = new Label
            {
                Text = " [Окно 2] Содержимое образа (Перетащите сюда файлы снизу для добавления в ISO)",
                Dock = DockStyle.Top,
                Height = 24,
                TextAlign = ContentAlignment.MiddleLeft,
                BackColor = Color.FromArgb(41, 76, 122),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };
            _lvIsoFiles = new ListView
            {
                Dock = DockStyle.Fill,
                View = View.Details,
                FullRowSelect = true,
                GridLines = true,
                SmallImageList = _smallIcons,
                AllowDrop = true
            };
            _lvIsoFiles.Columns.Add("Имя файла / папки", 310);
            _lvIsoFiles.Columns.Add("Размер", 120, HorizontalAlignment.Right);
            _lvIsoFiles.Columns.Add("Дата изменения", 150);
            _lvIsoFiles.Columns.Add("Атрибуты", 130);

            _lvIsoFiles.DoubleClick += (_, _) =>
            {
                if (_lvIsoFiles.SelectedItems.Count == 1 && _lvIsoFiles.SelectedItems[0].Tag is IsoNode node && node.IsDirectory)
                {
                    _currentIsoFolder = node;
                    SelectNodeInIsoTree(node);
                    RefreshIsoFilesList();
                }
            };

            // Контекстное меню для Окна 2 (Содержимое образа)
            var ctxIso = new ContextMenuStrip();
            ctxIso.Items.Add("Новая папка...", null, (_, _) => ActionCreateIsoFolder());
            ctxIso.Items.Add("Извлечь на ПК...", null, (_, _) => ActionExtractSelectedIsoNodes());
            ctxIso.Items.Add("Переименовать...", null, (_, _) => ActionRenameSelectedIsoNode());
            ctxIso.Items.Add("Удалить", null, (_, _) => ActionDeleteSelectedIsoNodes());
            ctxIso.Items.Add(new ToolStripSeparator());
            ctxIso.Items.Add("Атрибуты (Скрытый / Только чтение)...", null, (_, _) => ActionChangeAttributes());
            _lvIsoFiles.ContextMenuStrip = ctxIso;

            pnlTopRight.Controls.Add(_lvIsoFiles);
            pnlTopRight.Controls.Add(lblTopRightHeader);

            topSplit.Panel1.Controls.Add(pnlTopLeft);
            topSplit.Panel2.Controls.Add(pnlTopRight);

            // ---------------- НИЖНЯЯ ПОЛОВИНА (Ваш компьютер: Окно 3 и Окно 4) ----------------
            var bottomSplit = new SplitContainer
            {
                Dock = DockStyle.Fill,
                Orientation = Orientation.Vertical,
                SplitterDistance = 320,
                SplitterWidth = 5
            };

            // Окно 3: Нижнее левое — Дерево ПК (Локальные диски C:, D:, флешки)
            var pnlBottomLeft = new Panel { Dock = DockStyle.Fill };
            var lblBottomLeftHeader = new Label
            {
                Text = " [Окно 3] Дерево ПК (Локальные диски и флешки)",
                Dock = DockStyle.Top,
                Height = 24,
                TextAlign = ContentAlignment.MiddleLeft,
                BackColor = Color.FromArgb(62, 92, 118),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };
            _tvLocalTree = new TreeView
            {
                Dock = DockStyle.Fill,
                ImageList = _smallIcons,
                HideSelection = false
            };
            _tvLocalTree.BeforeExpand += TvLocalTree_BeforeExpand;
            _tvLocalTree.AfterSelect += TvLocalTree_AfterSelect;
            pnlBottomLeft.Controls.Add(_tvLocalTree);
            pnlBottomLeft.Controls.Add(lblBottomLeftHeader);

            // Окно 4: Нижнее правое — Локальные файлы
            var pnlBottomRight = new Panel { Dock = DockStyle.Fill };
            _lblLocalBanner = new Label
            {
                Text = " [Окно 4] Локальные файлы ПК (Перетащите файлы отсюда наверх в образ)",
                Dock = DockStyle.Top,
                Height = 24,
                TextAlign = ContentAlignment.MiddleLeft,
                BackColor = Color.FromArgb(62, 92, 118),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };
            _lvLocalFiles = new ListView
            {
                Dock = DockStyle.Fill,
                View = View.Details,
                FullRowSelect = true,
                GridLines = true,
                SmallImageList = _smallIcons,
                AllowDrop = true
            };
            _lvLocalFiles.Columns.Add("Имя файла / папки", 310);
            _lvLocalFiles.Columns.Add("Размер", 120, HorizontalAlignment.Right);
            _lvLocalFiles.Columns.Add("Дата изменения", 150);
            _lvLocalFiles.Columns.Add("Тип / Атрибуты", 130);

            _lvLocalFiles.DoubleClick += (_, _) =>
            {
                if (_lvLocalFiles.SelectedItems.Count == 1 && _lvLocalFiles.SelectedItems[0].Tag is string path && Directory.Exists(path))
                {
                    NavigateToLocalFolder(path);
                }
            };

            var ctxLocal = new ContextMenuStrip();
            ctxLocal.Items.Add("Добавить выбранное в ISO-образ (Наверх)", null, (_, _) => ToolbarAddSelectedFromLocalPane());
            ctxLocal.Items.Add("Проверить контрольные суммы файла...", null, (_, _) =>
            {
                if (_lvLocalFiles.SelectedItems.Count == 1 && _lvLocalFiles.SelectedItems[0].Tag is string p && File.Exists(p))
                {
                    using var dlg = new ChecksumDialog(p);
                    dlg.ShowDialog(this);
                }
            });
            ctxLocal.Items.Add("Обновить список", null, (_, _) => NavigateToLocalFolder(_currentLocalPath));
            _lvLocalFiles.ContextMenuStrip = ctxLocal;

            pnlBottomRight.Controls.Add(_lvLocalFiles);
            pnlBottomRight.Controls.Add(_lblLocalBanner);

            bottomSplit.Panel1.Controls.Add(pnlBottomLeft);
            bottomSplit.Panel2.Controls.Add(pnlBottomRight);

            mainVerticalSplit.Panel1.Controls.Add(topSplit);
            mainVerticalSplit.Panel2.Controls.Add(bottomSplit);

            // Configure Drag-and-Drop between Bottom (PC) and Top (ISO)
            SetupDragAndDropHandlers();

            return mainVerticalSplit;
        }

        private void SetupDragAndDropHandlers()
        {
            // 1. Start dragging from Local Files (Окно 4 -> Окно 2)
            _lvLocalFiles.ItemDrag += (_, _) =>
            {
                var paths = _lvLocalFiles.SelectedItems.Cast<ListViewItem>()
                    .Select(i => i.Tag as string)
                    .Where(p => !string.IsNullOrEmpty(p) && p != "..")
                    .Cast<string>()
                    .ToArray();
                if (paths.Length == 0) return;

                var data = new DataObject();
                data.SetData(DragFormatLocalPaths, paths);
                data.SetData(DataFormats.FileDrop, paths);
                _lvLocalFiles.DoDragDrop(data, DragDropEffects.Copy);
            };

            // 2. Accept drop on ISO Files (Окно 2) from Local Pane or Windows Explorer
            _lvIsoFiles.DragEnter += (_, e) =>
            {
                if (e.Data != null && (e.Data.GetDataPresent(DragFormatLocalPaths) || e.Data.GetDataPresent(DataFormats.FileDrop)))
                    e.Effect = DragDropEffects.Copy;
                else
                    e.Effect = DragDropEffects.None;
            };

            _lvIsoFiles.DragDrop += (_, e) =>
            {
                if (e.Data == null) return;
                string[]? paths = e.Data.GetData(DragFormatLocalPaths) as string[]
                                  ?? e.Data.GetData(DataFormats.FileDrop) as string[];
                if (paths == null || paths.Length == 0) return;

                AddLocalPathsToIsoFolder(_currentIsoFolder, paths);
            };

            // 3. Start dragging from ISO Files (Окно 2 -> Окно 4 для извлечения на ПК)
            _lvIsoFiles.ItemDrag += (_, _) =>
            {
                var nodes = _lvIsoFiles.SelectedItems.Cast<ListViewItem>()
                    .Select(i => i.Tag as IsoNode)
                    .Where(n => n != null)
                    .Cast<IsoNode>()
                    .ToArray();
                if (nodes.Length == 0) return;

                var data = new DataObject();
                data.SetData(DragFormatIsoNodes, nodes);
                _lvIsoFiles.DoDragDrop(data, DragDropEffects.Copy);
            };

            // 4. Accept drop on Local Files (Окно 4) from ISO Pane (Top -> Bottom extraction)
            _lvLocalFiles.DragEnter += (_, e) =>
            {
                if (e.Data != null && e.Data.GetDataPresent(DragFormatIsoNodes))
                    e.Effect = DragDropEffects.Copy;
                else
                    e.Effect = DragDropEffects.None;
            };

            _lvLocalFiles.DragDrop += (_, e) =>
            {
                if (e.Data?.GetData(DragFormatIsoNodes) is IsoNode[] nodes && nodes.Length > 0)
                {
                    ExtractNodesToCurrentLocalFolder(nodes);
                }
            };
        }

        // =========================================================================
        // 4. СТРОКА СОСТОЯНИЯ И ИНДИКАТОР ОБЪЕМА (Самый низ окна)
        // =========================================================================
        private Control BuildStatusBarWithCapacityGauge()
        {
            var bottomPanel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 32,
                BackColor = Color.FromArgb(232, 236, 242),
                Padding = new Padding(6, 4, 6, 4)
            };

            _statusStrip = new StatusStrip
            {
                Dock = DockStyle.Fill,
                BackColor = Color.Transparent,
                SizingGrip = false
            };

            _lblStatusPath = new ToolStripStatusLabel
            {
                Text = "Путь: / | Файлов: 0 | Папок: 0",
                Spring = true,
                TextAlign = ContentAlignment.MiddleLeft
            };

            _lblBootStatus = new ToolStripStatusLabel
            {
                Text = "Несамозагружаемый",
                ForeColor = Color.FromArgb(100, 110, 125),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold)
            };

            _capacityMeter = new CapacityMeterControl();
            var hostMeter = new ToolStripControlHost(_capacityMeter)
            {
                AutoSize = false,
                Width = 340,
                Height = 22
            };

            _cmbMediaTarget = new ComboBox
            {
                DropDownStyle = ComboBoxStyle.DropDownList,
                Width = 145,
                Font = new Font("Segoe UI", 8.5f)
            };
            _cmbMediaTarget.Items.AddRange(new object[]
            {
                "CD 700MB",
                "DVD 4.7GB",
                "DVD 8.5GB (DL)",
                "Blu-Ray 25GB",
                "USB Flash 64GB"
            });
            _cmbMediaTarget.SelectedIndex = 0;
            _cmbMediaTarget.SelectedIndexChanged += (_, _) =>
            {
                _warnedOverCapacity = false;
                UpdateStatusAndCapacityBar();
            };

            var hostCombo = new ToolStripControlHost(_cmbMediaTarget)
            {
                AutoSize = false,
                Width = 150,
                Height = 24
            };

            _statusStrip.Items.AddRange(new ToolStripItem[]
            {
                _lblStatusPath,
                new ToolStripSeparator(),
                _lblBootStatus,
                new ToolStripSeparator(),
                new ToolStripStatusLabel("Заполненность:"),
                hostMeter,
                new ToolStripStatusLabel("Носитель:"),
                hostCombo
            });

            bottomPanel.Controls.Add(_statusStrip);
            return bottomPanel;
        }

        // =========================================================================
        // ОБНОВЛЕНИЕ ДЕРЕВА ОБРАЗА, ЛОКАЛЬНОГО ПРОВОДНИКА И ШКАЛЫ ЗАПОЛНЕННОСТИ
        // =========================================================================
        private void RefreshIsoTree()
        {
            _tvIsoTree.BeginUpdate();
            _tvIsoTree.Nodes.Clear();

            _project.Root.Name = _project.Properties.VolumeLabel;
            var rootTreeNode = new TreeNode(_project.Root.Name)
            {
                Tag = _project.Root,
                ImageKey = "disc",
                SelectedImageKey = "disc"
            };

            BuildIsoSubtree(_project.Root, rootTreeNode);
            _tvIsoTree.Nodes.Add(rootTreeNode);
            rootTreeNode.Expand();
            _tvIsoTree.SelectedNode = rootTreeNode;
            _tvIsoTree.EndUpdate();

            _currentIsoFolder = _project.Root;
            RefreshIsoFilesList();
        }

        private void BuildIsoSubtree(IsoNode dirNode, TreeNode treeNode)
        {
            foreach (var childDir in dirNode.Children.Where(c => c.IsDirectory).OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase))
            {
                var childTn = new TreeNode(childDir.Name)
                {
                    Tag = childDir,
                    ImageKey = "folder",
                    SelectedImageKey = "folder"
                };
                BuildIsoSubtree(childDir, childTn);
                treeNode.Nodes.Add(childTn);
            }
        }

        private void SelectNodeInIsoTree(IsoNode target)
        {
            TreeNode? FindNode(TreeNodeCollection nodes)
            {
                foreach (TreeNode tn in nodes)
                {
                    if (tn.Tag == target) return tn;
                    var sub = FindNode(tn.Nodes);
                    if (sub != null) return sub;
                }
                return null;
            }

            var match = FindNode(_tvIsoTree.Nodes);
            if (match != null)
            {
                _tvIsoTree.SelectedNode = match;
                match.EnsureVisible();
            }
        }

        private void RefreshIsoFilesList()
        {
            _lvIsoFiles.BeginUpdate();
            _lvIsoFiles.Items.Clear();

            if (_currentIsoFolder.Parent != null)
            {
                var upItem = new ListViewItem("..")
                {
                    Tag = _currentIsoFolder.Parent,
                    ImageKey = "folder"
                };
                upItem.SubItems.Add("<ВВЕРХ>");
                upItem.SubItems.Add("");
                upItem.SubItems.Add("");
                _lvIsoFiles.Items.Add(upItem);
            }

            var sorted = _currentIsoFolder.Children
                .OrderByDescending(c => c.IsDirectory)
                .ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase);

            foreach (var child in sorted)
            {
                var item = new ListViewItem(child.Name)
                {
                    Tag = child,
                    ImageKey = child.IsDirectory ? "folder" : "file"
                };
                if (child.Attributes.HasFlag(IsoNodeAttributes.Hidden))
                    item.ForeColor = Color.Gray;

                item.SubItems.Add(child.IsDirectory ? "<ПАПКА>" : FormatBytesExact(child.Size));
                item.SubItems.Add(child.CreationTime.ToString("yyyy-MM-dd HH:mm"));
                item.SubItems.Add(FormatIsoAttributes(child.Attributes));
                _lvIsoFiles.Items.Add(item);
            }

            _lvIsoFiles.EndUpdate();
            UpdateStatusAndCapacityBar();
        }

        private void PopulateLocalDrivesTree()
        {
            _tvLocalTree.BeginUpdate();
            _tvLocalTree.Nodes.Clear();

            foreach (var drive in DriveInfo.GetDrives())
            {
                if (!drive.IsReady) continue;
                string label = string.IsNullOrWhiteSpace(drive.VolumeLabel) ? drive.DriveType.ToString() : drive.VolumeLabel;
                var driveNode = new TreeNode($"{drive.Name} [{label}]")
                {
                    Tag = drive.RootDirectory.FullName,
                    ImageKey = "drive",
                    SelectedImageKey = "drive"
                };
                driveNode.Nodes.Add(new TreeNode("...")); // Lazy-load placeholder
                _tvLocalTree.Nodes.Add(driveNode);
            }

            _tvLocalTree.EndUpdate();
            NavigateToLocalFolder(_currentLocalPath);
        }

        private void TvLocalTree_BeforeExpand(object? sender, TreeViewCancelEventArgs e)
        {
            if (e.Node == null || e.Node.Tag is not string dirPath) return;
            if (e.Node.Nodes.Count == 1 && e.Node.Nodes[0].Tag == null)
            {
                e.Node.Nodes.Clear();
                try
                {
                    foreach (var sub in Directory.GetDirectories(dirPath).OrderBy(d => Path.GetFileName(d)))
                    {
                        var di = new DirectoryInfo(sub);
                        if (di.Attributes.HasFlag(FileAttributes.System)) continue;
                        var subNode = new TreeNode(di.Name)
                        {
                            Tag = di.FullName,
                            ImageKey = "folder",
                            SelectedImageKey = "folder"
                        };
                        try
                        {
                            if (Directory.GetDirectories(di.FullName).Length > 0)
                                subNode.Nodes.Add(new TreeNode("..."));
                        }
                        catch { }
                        e.Node.Nodes.Add(subNode);
                    }
                }
                catch { }
            }
        }

        private void TvLocalTree_AfterSelect(object? sender, TreeViewEventArgs e)
        {
            if (e.Node?.Tag is string dirPath && Directory.Exists(dirPath))
            {
                NavigateToLocalFolder(dirPath);
            }
        }

        private void NavigateToLocalFolder(string folderPath)
        {
            if (!Directory.Exists(folderPath)) return;
            _currentLocalPath = folderPath;
            _lblLocalBanner.Text = $" [Окно 4] Локальные файлы ПК: {_currentLocalPath}";

            _lvLocalFiles.BeginUpdate();
            _lvLocalFiles.Items.Clear();

            var parent = Directory.GetParent(folderPath);
            if (parent != null)
            {
                var up = new ListViewItem("..")
                {
                    Tag = parent.FullName,
                    ImageKey = "folder"
                };
                up.SubItems.Add("<ВВЕРХ>");
                up.SubItems.Add("");
                up.SubItems.Add("");
                _lvLocalFiles.Items.Add(up);
            }

            try
            {
                foreach (var dir in Directory.GetDirectories(folderPath).OrderBy(Path.GetFileName))
                {
                    var di = new DirectoryInfo(dir);
                    var item = new ListViewItem(di.Name)
                    {
                        Tag = di.FullName,
                        ImageKey = "folder"
                    };
                    item.SubItems.Add("<ПАПКА>");
                    item.SubItems.Add(di.LastWriteTime.ToString("yyyy-MM-dd HH:mm"));
                    item.SubItems.Add("Папка с файлами");
                    _lvLocalFiles.Items.Add(item);
                }

                foreach (var file in Directory.GetFiles(folderPath).OrderBy(Path.GetFileName))
                {
                    var fi = new FileInfo(file);
                    var item = new ListViewItem(fi.Name)
                    {
                        Tag = fi.FullName,
                        ImageKey = "file"
                    };
                    item.SubItems.Add(FormatBytesExact(fi.Length));
                    item.SubItems.Add(fi.LastWriteTime.ToString("yyyy-MM-dd HH:mm"));
                    item.SubItems.Add(fi.Extension.ToUpperInvariant());
                    _lvLocalFiles.Items.Add(item);
                }
            }
            catch { }

            _lvLocalFiles.EndUpdate();
        }

        private void UpdateStatusAndCapacityBar()
        {
            string fileTitle = string.IsNullOrEmpty(_project.CurrentFilePath)
                ? "Новый проект ISO"
                : Path.GetFileName(_project.CurrentFilePath);
            string dirtyMark = _project.IsDirty ? " *" : "";
            Text = $"UltraISO Studio x64 — [{fileTitle}{dirtyMark}] ({_project.Properties.VolumeLabel})";

            string bootText = _project.IsBootable
                ? $"Самозагружаемый (El Torito: {_project.BootImageName})"
                : "Несамозагружаемый образ";
            _lblIsoBanner.Text = $" [Окно 1] Дерево образа: {_project.Properties.VolumeLabel} | ФС: {_project.Properties.FileSystem} | {bootText}";
            _lblBootStatus.Text = bootText;
            _lblBootStatus.ForeColor = _project.IsBootable ? Color.FromArgb(25, 135, 84) : Color.FromArgb(110, 120, 135);

            int filesInCurr = _currentIsoFolder.Children.Count(c => !c.IsDirectory);
            int dirsInCurr = _currentIsoFolder.Children.Count(c => c.IsDirectory);
            _lblStatusPath.Text = $"Путь в образе: {_currentIsoFolder.FullIsoPath}  |  Файлов в папке: {filesInCurr}, Папок: {dirsInCurr}  |  Локальный путь: {_currentLocalPath}";

            long usedBytes = _project.GetEstimatedIsoSizeBytes();
            string mediaChoice = _cmbMediaTarget.SelectedItem?.ToString() ?? "CD 700MB";
            long maxBytes = mediaChoice switch
            {
                "CD 700MB" => 700L * 1024 * 1024,
                "DVD 4.7GB" => 4700000000L,
                "DVD 8.5GB (DL)" => 8500000000L,
                "Blu-Ray 25GB" => 25000000000L,
                "USB Flash 64GB" => 64L * 1024 * 1024 * 1024,
                _ => 700L * 1024 * 1024
            };

            _capacityMeter.UsedBytes = usedBytes;
            _capacityMeter.MaxBytes = maxBytes;
            _capacityMeter.MediaLabel = mediaChoice;
            _capacityMeter.Invalidate();

            if (_capacityMeter.IsOverCapacity && !_warnedOverCapacity)
            {
                _warnedOverCapacity = true;
                MessageBox.Show(
                    $"Внимание! Итоговый размер образа ({CapacityMeterControl.FormatSize(usedBytes)}) превышает емкость выбранного носителя '{mediaChoice}' ({CapacityMeterControl.FormatSize(maxBytes)}).\n\n" +
                    "Образ не влезет на выбранную болванку. Выберите носитель большего объема (например, DVD 4.7GB или DVD 8.5GB) в правом нижнем углу или удалите лишние файлы.",
                    "Превышен объем целевого носителя",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
            }
            else if (!_capacityMeter.IsOverCapacity)
            {
                _warnedOverCapacity = false;
            }
        }

        // =========================================================================
        // ОПЕРАЦИИ МЕНЮ "ФАЙЛ", "ДЕЙСТВИЕ", "САМОЗАГРУЗКА", "ИНСТРУМЕНТЫ", "ОПЦИИ"
        // =========================================================================
        private void CreateNewProject()
        {
            if (_project.IsDirty)
            {
                var ask = MessageBox.Show("Сохранить изменения в текущем проекте перед созданием нового?", "UltraISO Studio", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
                if (ask == DialogResult.Cancel) return;
                if (ask == DialogResult.Yes) SaveCurrentProject(false);
            }
            _project.ResetNew();
            _warnedOverCapacity = false;
            RefreshIsoTree();
        }

        private void PromptOpenImage()
        {
            using var ofd = new OpenFileDialog
            {
                Title = "Открыть образ диска",
                Filter = "Образы дисков (*.iso;*.isz;*.mdf;*.nrg;*.img;*.bin)|*.iso;*.isz;*.mdf;*.nrg;*.img;*.bin|Все файлы (*.*)|*.*"
            };
            if (ofd.ShowDialog(this) == DialogResult.OK)
            {
                OpenImageFile(ofd.FileName);
            }
        }

        public void OpenImageFile(string filePath)
        {
            try
            {
                string ext = Path.GetExtension(filePath).ToLowerInvariant();
                string isoToLoad = filePath;

                if (ext == ".isz" || ext == ".mdf" || ext == ".nrg" || ext == ".img" || ext == ".bin")
                {
                    string tempIso = Path.Combine(Path.GetTempPath(), $"ultraiso_opened_{Guid.NewGuid():N}.iso");
                    ImageFormatService.ConvertToStandardIso(filePath, tempIso);
                    isoToLoad = tempIso;
                }

                _project = IsoEngine.LoadIsoImage(isoToLoad);
                _project.CurrentFilePath = filePath;
                _warnedOverCapacity = false;
                RefreshIsoTree();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Не удалось открыть образ '{filePath}':\n{ex.Message}", "Ошибка открытия образа", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void SaveCurrentProject(bool saveAs)
        {
            string? targetPath = _project.CurrentFilePath;
            if (saveAs || string.IsNullOrEmpty(targetPath) || !targetPath.EndsWith(".iso", StringComparison.OrdinalIgnoreCase))
            {
                using var sfd = new SaveFileDialog
                {
                    Title = "Сохранить образ ISO",
                    Filter = "Стандартный образ ISO (*.iso)|*.iso|Сжатый образ ISZ (*.isz)|*.isz",
                    FileName = string.IsNullOrWhiteSpace(_project.Properties.VolumeLabel) ? "image.iso" : $"{_project.Properties.VolumeLabel}.iso"
                };
                if (sfd.ShowDialog(this) != DialogResult.OK) return;
                targetPath = sfd.FileName;
            }

            try
            {
                Cursor = Cursors.WaitCursor;
                if (targetPath.EndsWith(".isz", StringComparison.OrdinalIgnoreCase))
                {
                    string tempIso = Path.Combine(Path.GetTempPath(), $"ultraiso_tmp_{Guid.NewGuid():N}.iso");
                    try
                    {
                        IsoEngine.SaveIsoImage(_project, tempIso);
                        ImageFormatService.CompressIsoToIsz(tempIso, targetPath);
                        _project.CurrentFilePath = targetPath;
                        _project.IsDirty = false;
                    }
                    finally
                    {
                        if (File.Exists(tempIso)) File.Delete(tempIso);
                    }
                }
                else
                {
                    IsoEngine.SaveIsoImage(_project, targetPath);
                }

                UpdateStatusAndCapacityBar();
                MessageBox.Show($"Образ успешно сохранен:\n{targetPath}", "Сохранение завершено", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка сохранения образа:\n{ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        private void OpenProjectProperties()
        {
            using var dlg = new PropertiesDialog(_project.Properties);
            if (dlg.ShowDialog(this) == DialogResult.OK)
            {
                _project.Root.Name = _project.Properties.VolumeLabel;
                _project.IsDirty = true;
                RefreshIsoTree();
            }
        }

        private void ActionCreateIsoFolder()
        {
            using var dlg = new TextPromptDialog("Создать папку в образе", "Введите имя новой папки:", "Новая_папка");
            if (dlg.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(dlg.InputValue))
            {
                _project.AddFolder(_currentIsoFolder, dlg.InputValue);
                RefreshIsoTree();
                SelectNodeInIsoTree(_currentIsoFolder);
                RefreshIsoFilesList();
            }
        }

        private void ActionAddLocalFilesDialog()
        {
            using var ofd = new OpenFileDialog
            {
                Title = "Выберите файлы для добавления в ISO-образ",
                Multiselect = true,
                Filter = "Все файлы (*.*)|*.*"
            };
            if (ofd.ShowDialog(this) == DialogResult.OK)
            {
                AddLocalPathsToIsoFolder(_currentIsoFolder, ofd.FileNames);
            }
        }

        private void ActionAddLocalFolderDialog()
        {
            using var fbd = new FolderBrowserDialog
            {
                Description = "Выберите папку на компьютере для добавления в текущую директорию ISO-образа",
                SelectedPath = _currentLocalPath
            };
            if (fbd.ShowDialog(this) == DialogResult.OK && Directory.Exists(fbd.SelectedPath))
            {
                AddLocalPathsToIsoFolder(_currentIsoFolder, new[] { fbd.SelectedPath });
            }
        }

        private void ToolbarAddSelectedFromLocalPane()
        {
            var selectedPaths = _lvLocalFiles.SelectedItems.Cast<ListViewItem>()
                .Select(i => i.Tag as string)
                .Where(p => !string.IsNullOrEmpty(p) && p != "..")
                .Cast<string>()
                .ToArray();

            if (selectedPaths.Length == 0)
            {
                ActionAddLocalFilesDialog();
                return;
            }

            AddLocalPathsToIsoFolder(_currentIsoFolder, selectedPaths);
        }

        private void AddLocalPathsToIsoFolder(IsoNode targetFolder, string[] localPaths)
        {
            try
            {
                foreach (var p in localPaths)
                {
                    if (File.Exists(p))
                        _project.AddLocalFile(targetFolder, p);
                    else if (Directory.Exists(p))
                        _project.AddLocalDirectoryRecursive(targetFolder, p);
                }

                var savedCurrent = _currentIsoFolder;
                RefreshIsoTree();
                _currentIsoFolder = savedCurrent;
                SelectNodeInIsoTree(savedCurrent);
                RefreshIsoFilesList();
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message, "Ошибка добавления в образ", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void ActionExtractSelectedIsoNodes()
        {
            var nodes = _lvIsoFiles.SelectedItems.Cast<ListViewItem>()
                .Select(i => i.Tag as IsoNode)
                .Where(n => n != null && n != _currentIsoFolder.Parent)
                .Cast<IsoNode>()
                .ToArray();

            if (nodes.Length == 0)
            {
                // If nothing selected in list, offer to extract current folder or entire image
                nodes = new[] { _currentIsoFolder };
            }

            using var fbd = new FolderBrowserDialog
            {
                Description = "Выберите папку на ПК для извлечения файлов из ISO-образа",
                SelectedPath = _currentLocalPath
            };
            if (fbd.ShowDialog(this) == DialogResult.OK)
            {
                foreach (var node in nodes)
                    _project.ExtractNodeToDisk(node, fbd.SelectedPath);

                NavigateToLocalFolder(_currentLocalPath);
                MessageBox.Show($"Файлы успешно извлечены в:\n{fbd.SelectedPath}", "Извлечение завершено", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void ExtractNodesToCurrentLocalFolder(IsoNode[] nodes)
        {
            try
            {
                foreach (var node in nodes)
                {
                    if (node == _currentIsoFolder.Parent) continue;
                    _project.ExtractNodeToDisk(node, _currentLocalPath);
                }
                NavigateToLocalFolder(_currentLocalPath);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка извлечения файлов: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void ActionRenameSelectedIsoNode()
        {
            if (_lvIsoFiles.SelectedItems.Count != 1 || _lvIsoFiles.SelectedItems[0].Tag is not IsoNode node || node == _currentIsoFolder.Parent)
            {
                MessageBox.Show("Выберите один файл или папку в верхнем правом окне образа для переименования.", "Переименование", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using var dlg = new TextPromptDialog("Переименовать", "Новое имя файла или папки:", node.Name);
            if (dlg.ShowDialog(this) == DialogResult.OK && !string.IsNullOrWhiteSpace(dlg.InputValue))
            {
                node.Name = dlg.InputValue;
                _project.IsDirty = true;
                var saved = _currentIsoFolder;
                RefreshIsoTree();
                _currentIsoFolder = saved;
                SelectNodeInIsoTree(saved);
                RefreshIsoFilesList();
            }
        }

        private void ActionDeleteSelectedIsoNodes()
        {
            var nodes = _lvIsoFiles.SelectedItems.Cast<ListViewItem>()
                .Select(i => i.Tag as IsoNode)
                .Where(n => n != null && n != _currentIsoFolder.Parent)
                .Cast<IsoNode>()
                .ToArray();

            if (nodes.Length == 0) return;

            foreach (var n in nodes)
                _currentIsoFolder.Children.Remove(n);

            _project.IsDirty = true;
            var saved = _currentIsoFolder;
            RefreshIsoTree();
            _currentIsoFolder = saved;
            SelectNodeInIsoTree(saved);
            RefreshIsoFilesList();
        }

        private void ActionChangeAttributes()
        {
            if (_lvIsoFiles.SelectedItems.Count != 1 || _lvIsoFiles.SelectedItems[0].Tag is not IsoNode node || node == _currentIsoFolder.Parent)
            {
                MessageBox.Show("Выберите файл или папку внутри образа для изменения атрибутов (Скрытый / Только чтение / Системный).", "Атрибуты", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using var dlg = new NodeAttributesDialog(node);
            if (dlg.ShowDialog(this) == DialogResult.OK)
            {
                _project.IsDirty = true;
                RefreshIsoFilesList();
            }
        }

        // ---------------- САМОЗАГРУЗКА (BOOTABLE) ----------------
        private void OpenWriteDiskImageDialog()
        {
            using var dlg = new WriteDiskImageDialog(_project);
            dlg.ShowDialog(this);
        }

        private void BootLoadBootFile()
        {
            using var ofd = new OpenFileDialog
            {
                Title = "Загрузить загрузочный файл (Boot Sector / El Torito Image)",
                Filter = "Загрузочные файлы (*.bif;*.bin;*.img;*.ima;*.dat)|*.bif;*.bin;*.img;*.ima;*.dat|Все файлы (*.*)|*.*"
            };
            if (ofd.ShowDialog(this) == DialogResult.OK)
            {
                _project.BootImageData = File.ReadAllBytes(ofd.FileName);
                _project.BootImageName = Path.GetFileName(ofd.FileName);
                _project.IsDirty = true;
                UpdateStatusAndCapacityBar();
                MessageBox.Show($"Загрузочный сектор '{_project.BootImageName}' ({_project.BootImageData.Length} байт) успешно вшит в образ.\nСтатус образа: Самозагружаемый (El Torito).", "Загрузчик установлен", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void BootExtractBootFile()
        {
            if (!_project.IsBootable || _project.BootImageData == null)
            {
                MessageBox.Show("Текущий образ не содержит загрузочного сектора El Torito.", "Извлечение загрузчика", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            using var sfd = new SaveFileDialog
            {
                Title = "Сохранить извлеченный загрузочный файл",
                Filter = "Boot Image File (*.bif)|*.bif|Binary Boot Sector (*.bin;*.img)|*.bin;*.img",
                FileName = _project.BootImageName
            };
            if (sfd.ShowDialog(this) == DialogResult.OK)
            {
                File.WriteAllBytes(sfd.FileName, _project.BootImageData);
                MessageBox.Show($"Загрузочный сектор ({_project.BootImageData.Length} байт) успешно сохранен в:\n{sfd.FileName}", "Загрузчик извлечен", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void BootGenerateStandardElTorito()
        {
            // Creates a valid 2048-byte x86/x64 El Torito no-emulation boot sector with 0x55AA signature
            byte[] bootSector = new byte[2048];
            bootSector[0] = 0xEB; // JMP short
            bootSector[1] = 0x3C;
            bootSector[2] = 0x90; // NOP
            System.Text.Encoding.ASCII.GetBytes("ULTRAISO").CopyTo(bootSector, 3);
            bootSector[510] = 0x55;
            bootSector[511] = 0xAA;

            _project.BootImageData = bootSector;
            _project.BootImageName = "eltorito_boot.bif";
            _project.IsDirty = true;
            UpdateStatusAndCapacityBar();
            MessageBox.Show("Стандартный 2048-байтный загрузочный сектор El Torito (x86/x64) успешно сгенерирован и встроен в образ.", "Самозагрузка", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private void BootClearBootSector()
        {
            _project.BootImageData = null;
            _project.IsDirty = true;
            UpdateStatusAndCapacityBar();
        }

        // ---------------- ИНСТРУМЕНТЫ (TOOLS) & ОПЦИИ (OPTIONS) ----------------
        private void ToolMountVirtualDrive()
        {
            try
            {
                string pathToMount = EnsureSavedIsoForExternalTool();
                string msg = WindowsDiskService.MountIsoImage(pathToMount);
                MessageBox.Show(msg, "Виртуальный привод ISODrive", MessageBoxButtons.OK, MessageBoxIcon.Information);
                PopulateLocalDrivesTree();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка монтирования: {ex.Message}", "Виртуальный привод", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void ToolDismountVirtualDrive()
        {
            if (string.IsNullOrEmpty(_project.CurrentFilePath) || !File.Exists(_project.CurrentFilePath))
            {
                MessageBox.Show("Нет открытого файла образа для размонтирования.", "Размонтирование", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }
            string msg = WindowsDiskService.DismountIsoImage(_project.CurrentFilePath);
            MessageBox.Show(msg, "Виртуальный привод ISODrive", MessageBoxButtons.OK, MessageBoxIcon.Information);
            PopulateLocalDrivesTree();
        }

        private async void ToolCreateIsoFromDrive()
        {
            var drives = WindowsDiskService.GetOpticalAndAllDrives();
            if (drives.Count == 0)
            {
                MessageBox.Show("Не найдено доступных приводов или накопителей.", "Создание образа с диска", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            using var fbd = new FolderBrowserDialog
            {
                Description = "Выберите физический CD/DVD привод или USB-диск для снятия ISO-образа",
                SelectedPath = drives[0].DriveLetter
            };
            if (fbd.ShowDialog(this) != DialogResult.OK) return;

            using var sfd = new SaveFileDialog
            {
                Title = "Куда сохранить снятый ISO-образ",
                Filter = "Стандартный образ ISO (*.iso)|*.iso",
                FileName = "disc_backup.iso"
            };
            if (sfd.ShowDialog(this) != DialogResult.OK) return;

            try
            {
                Cursor = Cursors.WaitCursor;
                string srcDrive = fbd.SelectedPath;
                string dstIso = sfd.FileName;
                await Task.Run(() => WindowsDiskService.CreateIsoFromPhysicalDrive(srcDrive, dstIso));
                MessageBox.Show($"Образ с носителя '{srcDrive}' успешно создан:\n{dstIso}", "Готово", MessageBoxButtons.OK, MessageBoxIcon.Information);
                OpenImageFile(dstIso);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка снятия образа: {ex.Message}", "Ошибка", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            finally
            {
                Cursor = Cursors.Default;
            }
        }

        private void ToolBurnOpticalDisc()
        {
            try
            {
                string isoPath = EnsureSavedIsoForExternalTool();
                string msg = WindowsDiskService.BurnIsoToOpticalDisc(isoPath, null);
                MessageBox.Show(msg, "Запись CD/DVD-болванки", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Ошибка запуска записи CD/DVD: {ex.Message}", "Запись диска", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
        }

        private void OpenConverterDialog(bool defaultToIsz)
        {
            using var dlg = new FormatConverterDialog(_project.CurrentFilePath, defaultToIsz);
            dlg.ShowDialog(this);
        }

        private void OpenChecksumDialog()
        {
            string? initial = _project.CurrentFilePath;
            if (string.IsNullOrEmpty(initial) && _lvLocalFiles.SelectedItems.Count == 1 && _lvLocalFiles.SelectedItems[0].Tag is string p && File.Exists(p))
                initial = p;

            using var dlg = new ChecksumDialog(initial);
            dlg.ShowDialog(this);
        }

        private void OpenOptionsDialog()
        {
            using var dlg = new OptionsDialog(WindowsDiskService.Settings);
            dlg.ShowDialog(this);
        }

        private string EnsureSavedIsoForExternalTool()
        {
            if (!string.IsNullOrEmpty(_project.CurrentFilePath) && File.Exists(_project.CurrentFilePath) && !_project.IsDirty)
                return _project.CurrentFilePath;

            string tempPath = Path.Combine(Path.GetTempPath(), $"{_project.Properties.VolumeLabel}.iso");
            IsoEngine.SaveIsoImage(_project, tempPath);
            return tempPath;
        }

        private static string FormatBytesExact(long bytes)
        {
            if (bytes >= 1024L * 1024 * 1024)
                return $"{bytes / (1024.0 * 1024 * 1024):0.00} ГБ";
            if (bytes >= 1024 * 1024)
                return $"{bytes / (1024.0 * 1024.0):0.00} МБ";
            if (bytes >= 1024)
                return $"{bytes / 1024.0:0.0} КБ";
            return $"{bytes} Б";
        }

        private static string FormatIsoAttributes(IsoNodeAttributes attr)
        {
            if (attr == IsoNodeAttributes.Normal) return "Обычный (Normal)";
            var parts = new List<string>();
            if (attr.HasFlag(IsoNodeAttributes.Hidden)) parts.Add("Скрытый");
            if (attr.HasFlag(IsoNodeAttributes.ReadOnly)) parts.Add("Чтение");
            if (attr.HasFlag(IsoNodeAttributes.System)) parts.Add("Системный");
            if (attr.HasFlag(IsoNodeAttributes.Archive)) parts.Add("Архивный");
            return string.Join(", ", parts);
        }
    }
}
