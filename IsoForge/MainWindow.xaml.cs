using DiscUtils.Iso9660;
using Microsoft.Win32;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Security.Cryptography;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace IsoForge;

public partial class MainWindow : Window
{
    private readonly ObservableCollection<Entry> isoItems = new();
    private readonly ObservableCollection<Entry> pcItems = new();
    private readonly Dictionary<string, byte[]> files = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> directories = new(StringComparer.OrdinalIgnoreCase) { "/" };
    private string currentIsoDir = "/";
    private string currentPcDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    private string? openedIso;
    private string? bootFile;
    private string? selectedIsoPath;
    private string? selectedPcPath;
    private long imageBytes;
    private long mediaLimit = 4_700_000_000;

    public MainWindow()
    {
        InitializeComponent();
        IsoList.ItemsSource = isoItems; PcList.ItemsSource = pcItems;
        LoadPcDrives();
        ShowPcFolder(currentPcDir);
        RefreshIso();
    }

    private record Entry(string Name, string Kind, string SizeText, string FullPath, bool IsDirectory, long Size = 0);
    private static string Norm(string p) => "/" + string.Join("/", p.Replace('\\','/').Split('/', StringSplitOptions.RemoveEmptyEntries));
    private static string Parent(string p) { var n=Norm(p); var i=n.LastIndexOf('/'); return i<=0?"/":n[..i]; }
    private static string Join(string a,string b) => Norm((a=="/"?"":a)+"/"+b);

    private void LoadPcDrives()
    {
        PcTree.Items.Clear();
        foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady))
        {
            var node = new TreeViewItem { Header = drive.Name, Tag = drive.RootDirectory.FullName };
            node.Items.Add(new TreeViewItem { Header = "..." });
            node.Expanded += PcNode_Expanded;
            PcTree.Items.Add(node);
        }
    }
    private void PcNode_Expanded(object sender, RoutedEventArgs e)
    {
        if (sender is not TreeViewItem node || node.Tag is not string path) return;
        if (node.Items.Count == 1 && node.Items[0] is TreeViewItem t && Equals(t.Header,"..."))
        {
            node.Items.Clear();
            try { foreach(var d in Directory.GetDirectories(path)) { var child=new TreeViewItem{Header=System.IO.Path.GetFileName(d),Tag=d}; child.Items.Add(new TreeViewItem{Header="..."}); child.Expanded+=PcNode_Expanded; node.Items.Add(child); } } catch {}
        }
    }
    private void PcTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
    { if (PcTree.SelectedItem is TreeViewItem n && n.Tag is string p) { currentPcDir=p; ShowPcFolder(p); } }
    private void ShowPcFolder(string path)
    {
        currentPcDir=path; pcItems.Clear();
        try
        {
            foreach(var d in Directory.GetDirectories(path).OrderBy(x=>x))
                pcItems.Add(new Entry(System.IO.Path.GetFileName(d),"Папка","—",d,true));
            foreach(var f in Directory.GetFiles(path).OrderBy(x=>x))
            { var fi=new FileInfo(f); pcItems.Add(new Entry(fi.Name,fi.Extension,FormatSize(fi.Length),f,false,fi.Length)); }
        } catch(Exception ex) { Status("Не удалось прочитать папку: "+ex.Message); }
        PathText.Text="ПК: "+path;
    }
    private void PcList_DoubleClick(object sender, MouseButtonEventArgs e)
    { if(PcList.SelectedItem is Entry x) { if(x.IsDirectory) ShowPcFolder(x.FullPath); else AddLocalFiles(new[]{x.FullPath}); } }

    private void New_Click(object sender, RoutedEventArgs e)
    { files.Clear(); directories.Clear(); directories.Add("/"); openedIso=null; bootFile=null; currentIsoDir="/"; VolumeBox.Text="ISOFORGE"; RefreshIso(); Status("Создан новый пустой проект."); }
    private void Open_Click(object sender, RoutedEventArgs e)
    {
        var d=new OpenFileDialog{Filter="ISO images (*.iso)|*.iso|All files (*.*)|*.*"};
        if(d.ShowDialog()!=true)return;
        try
        {
            files.Clear(); directories.Clear(); directories.Add("/");
            using var stream=File.OpenRead(d.FileName); using var reader=new CDReader(stream,true);
            foreach(var dir in reader.GetDirectories("\\"))
                ImportDirectory(reader, dir);
            foreach(var f in reader.GetFiles("\\"))
                using(var input=reader.OpenFile(f,FileMode.Open)) using(var ms=new MemoryStream()) { input.CopyTo(ms); files[Norm(f)]=ms.ToArray(); }
            openedIso=d.FileName; currentIsoDir="/"; RefreshIso(); Status($"Открыт {d.FileName}. Файлов: {files.Count}");
        } catch(Exception ex) { MessageBox.Show("Не удалось открыть ISO.\n"+ex.Message,"IsoForge",MessageBoxButton.OK,MessageBoxImage.Error); }
    }
    private void ImportDirectory(CDReader reader,string dir)
    {
        var p=Norm(dir); directories.Add(p);
        foreach(var f in reader.GetFiles(dir))
            using(var input=reader.OpenFile(f,FileMode.Open)) using(var ms=new MemoryStream()) { input.CopyTo(ms); files[Norm(f)]=ms.ToArray(); }
        foreach(var child in reader.GetDirectories(dir)) ImportDirectory(reader,child);
    }
    private void RefreshIso()
    {
        isoItems.Clear();
        foreach(var d in directories.Where(x=>x!="/" && Parent(x)==currentIsoDir).OrderBy(x=>x))
            isoItems.Add(new Entry(System.IO.Path.GetFileName(d),"Папка","—",d,true));
        foreach(var f in files.Where(x=>Parent(x.Key)==currentIsoDir).OrderBy(x=>x.Key))
            isoItems.Add(new Entry(System.IO.Path.GetFileName(f.Key),System.IO.Path.GetExtension(f.Key),FormatSize(f.Value.LongLength),f.Key,false,f.Value.LongLength));
        IsoTree.Items.Clear();
        var root=new TreeViewItem{Header=VolumeBox.Text,Tag="/",IsExpanded=true}; IsoTree.Items.Add(root);
        foreach(var d in directories.Where(x=>x!="/").OrderBy(x=>x.Count(c=>c=='/')).ThenBy(x=>x))
        {
            var parent=FindTree(root,Parent(d));
            if(parent!=null) parent.Items.Add(new TreeViewItem{Header=System.IO.Path.GetFileName(d),Tag=d});
        }
        PathText.Text="ISO: "+currentIsoDir; UpdateSize();
    }
    private TreeViewItem? FindTree(TreeViewItem root,string path)
    { if(Equals(root.Tag,path))return root; foreach(TreeViewItem c in root.Items){var r=FindTree(c,path);if(r!=null)return r;} return null; }
    private void IsoTree_SelectedItemChanged(object sender,RoutedPropertyChangedEventArgs<object> e)
    { if(IsoTree.SelectedItem is TreeViewItem n && n.Tag is string p){currentIsoDir=p;RefreshIso();} }
    private void IsoList_DoubleClick(object sender,MouseButtonEventArgs e)
    { if(IsoList.SelectedItem is Entry x && x.IsDirectory){currentIsoDir=x.FullPath;RefreshIso();} }
    private void Add_Click(object sender,RoutedEventArgs e)
    { var d=new OpenFileDialog{Multiselect=true,Title="Добавить файлы в ISO"}; if(d.ShowDialog()==true)AddLocalFiles(d.FileNames); }
    private void AddLocalFiles(IEnumerable<string> paths)
    {
        foreach(var p in paths) try { var name=System.IO.Path.GetFileName(p); files[Join(currentIsoDir,name)]=File.ReadAllBytes(p); } catch(Exception ex){Status(ex.Message);}
        RefreshIso(); Status("Файлы добавлены в проект. Нажмите «Сохранить как», чтобы собрать ISO.");
    }
    private void IsoList_Drop(object sender,DragEventArgs e)
    { if(e.Data.GetData(DataFormats.FileDrop) is string[] paths) AddLocalFiles(paths.Where(File.Exists)); }
    private void Window_Drop(object sender,DragEventArgs e)
    { if(e.Data.GetData(DataFormats.FileDrop) is string[] paths) { var iso=paths.FirstOrDefault(x=>File.Exists(x)&&System.IO.Path.GetExtension(x).Equals(".iso",StringComparison.OrdinalIgnoreCase)); if(iso!=null){var dlg=new OpenFileDialog{FileName=iso}; try{files.Clear();directories.Clear();directories.Add("/");using var s=File.OpenRead(iso);using var r=new CDReader(s,true);ImportDirectory(r,"\\");openedIso=iso;RefreshIso();}catch(Exception ex){Status(ex.Message);}} else AddLocalFiles(paths.Where(File.Exists)); } }
    private void Extract_Click(object sender,RoutedEventArgs e)
    {
        if(IsoList.SelectedItem is not Entry x || x.IsDirectory){MessageBox.Show("Выберите файл в ISO.");return;}
        var d=new SaveFileDialog{FileName=x.Name}; if(d.ShowDialog()==true){File.WriteAllBytes(d.FileName,files[x.FullPath]);Status("Извлечено: "+d.FileName);}
    }
    private void SaveAs_Click(object sender,RoutedEventArgs e)
    {
        var d=new SaveFileDialog{Filter="ISO image (*.iso)|*.iso",DefaultExt=".iso",FileName="image.iso"}; if(d.ShowDialog()!=true)return;
        try
        {
            var builder=new CDBuilder{UseJoliet=FsCombo.SelectedIndex==1,VolumeIdentifier=SafeVolume(VolumeBox.Text)};
            foreach(var dir in directories.Where(x=>x!="/").OrderBy(x=>x.Count(c=>c=='/'))) builder.AddDirectory(dir.TrimStart('/').Replace('/','\\'));
            foreach(var f in files) builder.AddFile(f.Key.TrimStart('/').Replace('/','\\'),f.Value);
            builder.Build(d.FileName); openedIso=d.FileName; Status("ISO успешно создан: "+d.FileName);
        } catch(Exception ex){MessageBox.Show("Ошибка сборки ISO:\n"+ex.Message,"IsoForge");}
    }
    private static string SafeVolume(string s) { var v=new string(s.ToUpperInvariant().Where(c=>char.IsLetterOrDigit(c)||c=='_').Take(32).ToArray()); return string.IsNullOrWhiteSpace(v)?"ISOFORGE":v; }
    private void NewFolder_Click(object sender,RoutedEventArgs e)
    { var name=Ask("Имя новой папки:"); if(!string.IsNullOrWhiteSpace(name)){directories.Add(Join(currentIsoDir,name));RefreshIso();} }
    private void Rename_Click(object sender,RoutedEventArgs e)
    {
        if(IsoList.SelectedItem is not Entry x){return;} var name=Ask("Новое имя:");
        if(string.IsNullOrWhiteSpace(name))return; var target=Join(Parent(x.FullPath),name);
        if(x.IsDirectory){var descendants=directories.Where(p=>p==x.FullPath||p.StartsWith(x.FullPath+"/")).ToList();foreach(var p in descendants){directories.Remove(p);directories.Add(target+p[x.FullPath.Length..]);}}
        else {var data=files[x.FullPath];files.Remove(x.FullPath);files[target]=data;} RefreshIso();
    }
    private void Delete_Click(object sender,RoutedEventArgs e)
    {
        if(IsoList.SelectedItem is not Entry x)return;
        if(x.IsDirectory){foreach(var p in directories.Where(p=>p==x.FullPath||p.StartsWith(x.FullPath+"/")).ToList())directories.Remove(p);foreach(var p in files.Keys.Where(p=>p.StartsWith(x.FullPath+"/")).ToList())files.Remove(p);}
        else files.Remove(x.FullPath);RefreshIso();
    }
    private static string? Ask(string prompt)
    { var w=new Window{Title="IsoForge",Width=360,Height=140,WindowStartupLocation=WindowStartupLocation.CenterOwner,ResizeMode=ResizeMode.NoResize};var p=new StackPanel{Margin=new Thickness(12)};var t=new TextBox{Margin=new Thickness(0,8,0,8)};var b=new Button{Content="OK",IsDefault=true,Width=70,HorizontalAlignment=HorizontalAlignment.Right};string? value=null;b.Click+=(s,e)=>{value=t.Text;w.DialogResult=true;};p.Children.Add(new TextBlock{Text=prompt});p.Children.Add(t);p.Children.Add(b);w.Content=p;return w.ShowDialog()==true?value:null; }
    private void Properties_Click(object sender,RoutedEventArgs e)
    { MessageBox.Show("IsoForge 0.1\nФорматы сборки: ISO 9660 и Joliet.\nЧтение: ISO 9660/Joliet через DiscUtils.\nUDF и прямое редактирование исходного ISO пока не поддерживаются — проект пересобирается при сохранении.","Свойства образа"); }
    private void BootFile_Click(object sender,RoutedEventArgs e)
    { var d=new OpenFileDialog{Title="Выберите El Torito boot image",Filter="Все файлы|*.*"}; if(d.ShowDialog()==true){bootFile=d.FileName;MessageBox.Show("Файл выбран: "+bootFile+"\nПодключение El Torito в текущей версии ещё не реализовано.");} }
    private void ClearBoot_Click(object sender,RoutedEventArgs e){bootFile=null;Status("Загрузочный файл сброшен.");}
    private void Mount_Click(object sender,RoutedEventArgs e)
    { if(openedIso==null){MessageBox.Show("Сначала откройте или сохраните ISO.");return;} RunPowerShell($"Mount-DiskImage -ImagePath '{openedIso.Replace("'","''")}'"); }
    private void WriteUsb_Click(object sender,RoutedEventArgs e)
    { MessageBox.Show("Запись ISO на USB в этой версии отключена: она требует прямого доступа к физическому диску и может полностью уничтожить данные. Используйте проверенный Rufus или balenaEtcher.\n\nВ следующем этапе можно добавить безопасный выбор диска, проверку размера и двойное подтверждение.","Запись USB"); }
    private void DiscInfo_Click(object sender,RoutedEventArgs e)
    { MessageBox.Show("Создание ISO с физического CD/DVD и конвертация MDF/NRG/IMG будут добавлены отдельным модулем. Для съёмного носителя используйте создание образа через специализированный инструмент.","Инструменты"); }
    private void Hash_Click(object sender,RoutedEventArgs e)
    { var d=new OpenFileDialog{Filter="Все файлы|*.*"};if(d.ShowDialog()==true){using var s=File.OpenRead(d.FileName);var hash=Convert.ToHexString(SHA256.HashData(s));Clipboard.SetText(hash);MessageBox.Show("SHA-256:\n"+hash+"\n\nХэш скопирован в буфер обмена.");} }
    private void RunPowerShell(string command)
    { try{var psi=new ProcessStartInfo("powershell.exe",$"-NoProfile -Command \"{command}\""){UseShellExecute=true};Process.Start(psi);Status("Команда монтирования отправлена Windows.");}catch(Exception ex){MessageBox.Show(ex.Message);} }
    private void MediaCombo_SelectionChanged(object sender,SelectionChangedEventArgs e)
    { if(SizeBar==null)return;mediaLimit=MediaCombo.SelectedIndex switch{0=>700_000_000L,2=>8_500_000_000L,_=>4_700_000_000L};UpdateSize(); }
    private void UpdateSize()
    { imageBytes=files.Values.Sum(x=>(long)x.LongLength); if(SizeBar==null)return;SizeBar.Value=Math.Min(100,imageBytes/(double)mediaLimit*100);SizeBar.Foreground=imageBytes>mediaLimit?System.Windows.Media.Brushes.Red:System.Windows.Media.Brushes.LimeGreen;SizeText.Text=$"{FormatSize(imageBytes)} / {FormatSize(mediaLimit)}"+(imageBytes>mediaLimit?"  ПРЕВЫШЕН ОБЪЁМ":""); }
    private static string FormatSize(long n)=>n>=1_000_000_000?$"{n/1_000_000_000d:0.##} GB":$"{n/1_000_000d:0.##} MB";
    private void Status(string s)=>StatusText.Text=s;
    private void Exit_Click(object s,RoutedEventArgs e)=>Close();
    private void About_Click(object s,RoutedEventArgs e)=>MessageBox.Show("IsoForge 0.1.0\nWindows x64 ISO workspace\nOpen-source starter project.","О программе");
}
