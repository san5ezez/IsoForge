import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { downloadBlob, formatBytes, mediaById } from "@/lib/format";
import { useStudio } from "@/lib/model/store";
import { childrenOf, payloadBytes } from "@/lib/model/tree";
import { IMAGE_ROOT, PC_ROOT, type AppOptions, type Attrs, type BootEmulation, type FsKind } from "@/lib/model/types";

const field = "h-11 w-full border border-line bg-inset px-3 text-sm text-fg outline-none focus:border-accent";
const labelCls = "mb-1 block text-xs font-medium tracking-wide text-muted uppercase";
const primary = "h-11 bg-accent px-4 text-sm font-medium text-on-accent";
const quiet = "h-11 border border-line bg-raised px-4 text-sm text-fg";

const FS: { id: FsKind; title: string; text: string }[] = [
  {
    id: "iso9660",
    title: "ISO 9660",
    text: "Короткие имена 8.3 и максимальная совместимость. Длинные имена режутся, файлы больше 4 ГБ не помещаются.",
  },
  {
    id: "joliet",
    title: "Joliet",
    text: "Unicode поверх ISO 9660. Кириллица и длинные имена читаются в Windows. Предел имени — 64 символа.",
  },
  {
    id: "udf",
    title: "UDF",
    text: "Мост ISO 9660 + UDF. Длинные имена и файлы больше 4 ГБ. Для больших образов данных.",
  },
];

const EMU: { id: BootEmulation; label: string }[] = [
  { id: "none", label: "Без эмуляции (El Torito)" },
  { id: "floppy144", label: "Дискета 1.44 МБ" },
  { id: "floppy120", label: "Дискета 1.2 МБ" },
  { id: "floppy288", label: "Дискета 2.88 МБ" },
  { id: "hdd", label: "Жёсткий диск" },
];

function closeDialog() {
  useStudio.setState({ dialog: null, pendingFile: null });
}

function Shell({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-3 md:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[88dvh] w-full overflow-auto border border-line bg-surface shadow-lg ${wide ? "max-w-xl" : "max-w-md"}`}
      >
        <header className="sticky top-0 flex h-12 items-center justify-between border-b border-line bg-surface px-3">
          <h2 className="text-sm font-medium">{title}</h2>
          <button type="button" className="grid size-11 place-items-center text-muted" aria-label="Закрыть" onClick={closeDialog}>
            <X className="size-4" />
          </button>
        </header>
        <div className="flex flex-col gap-3 p-3">{children}</div>
      </div>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
}

function selectedNode() {
  const state = useStudio.getState();
  const id = (state.active === "image" ? state.imageSelection : state.pcSelection)[0];
  return id ? state.nodes[id] : undefined;
}

function Properties() {
  const project = useStudio((s) => s.project);
  const setProjectPatch = useStudio((s) => s.setProjectPatch);
  const [volumeId, setVolumeId] = useState(project.volumeId);
  const [publisher, setPublisher] = useState(project.publisher);
  const [preparer, setPreparer] = useState(project.preparer);
  const [application, setApplication] = useState(project.application);
  const [filesystem, setFilesystem] = useState<FsKind>(project.filesystem);
  const [bootable, setBootable] = useState(project.bootable);
  const [bootEmulation, setBootEmulation] = useState<BootEmulation>(project.bootEmulation);
  const chosen = FS.find((item) => item.id === filesystem) ?? FS[1];

  return (
    <Shell title="Свойства образа" wide>
      <label className={labelCls} htmlFor="vol">
        Метка тома
      </label>
      <input id="vol" className={field} value={volumeId} maxLength={32} onChange={(e) => setVolumeId(e.target.value)} />
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="pub">
            Издатель
          </label>
          <input id="pub" className={field} value={publisher} onChange={(e) => setPublisher(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="prep">
            Подготовил
          </label>
          <input id="prep" className={field} value={preparer} onChange={(e) => setPreparer(e.target.value)} />
        </div>
      </div>
      <label className={labelCls} htmlFor="app">
        Приложение
      </label>
      <input id="app" className={field} value={application} onChange={(e) => setApplication(e.target.value)} />
      <p className={labelCls}>Файловая система</p>
      <div className="grid gap-2">
        {FS.map((item) => (
          <label key={item.id} className={`flex cursor-pointer gap-3 border px-3 py-2 ${filesystem === item.id ? "border-accent bg-accent/10" : "border-line"}`}>
            <input type="radio" name="fs" className="mt-1 accent-accent" checked={filesystem === item.id} onChange={() => setFilesystem(item.id)} />
            <span>
              <span className="block text-sm font-medium">{item.title}</span>
              <span className="block text-sm text-pretty text-muted">{item.text}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-sm text-pretty text-muted">Сейчас выбрано: {chosen.title}.</p>
      <label className="flex h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="accent-accent" checked={bootable} onChange={(e) => setBootable(e.target.checked)} />
        Загрузочный образ (El Torito)
      </label>
      <label className={labelCls} htmlFor="emu">
        Эмуляция загрузки
      </label>
      <select id="emu" className={field} value={bootEmulation} disabled={!bootable} onChange={(e) => setBootEmulation(e.target.value as BootEmulation)}>
        {EMU.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      <Row>
        <button type="button" className={quiet} onClick={closeDialog}>
          Отмена
        </button>
        <button
          type="button"
          className={primary}
          onClick={() => {
            const id = volumeId.trim();
            if (!id || /[\\/]/.test(id)) {
              useStudio.getState().notify("Метка тома не должна быть пустой и не может содержать \\ или /.");
              return;
            }
            setProjectPatch({ volumeId: id, publisher, preparer, application, filesystem, bootable, bootEmulation });
            closeDialog();
          }}
        >
          Применить
        </button>
      </Row>
    </Shell>
  );
}

function NameDialog({ title, initial, submit }: { title: string; initial: string; submit: (name: string) => void }) {
  const [name, setName] = useState(initial);
  return (
    <Shell title={title}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(name);
        }}
      >
        <label className={labelCls} htmlFor="name">
          Имя
        </label>
        <input id="name" className={field} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        <Row>
          <button type="button" className={quiet} onClick={closeDialog}>
            Отмена
          </button>
          <button type="submit" className={primary}>
            OK
          </button>
        </Row>
      </form>
    </Shell>
  );
}

function AttrsDialog() {
  const node = selectedNode();
  const [attrs, setAttrs] = useState<Attrs>(node?.attrs ?? { hidden: false, system: false, archive: true, readonly: false });
  if (!node || node.kind === "drive") {
    return (
      <Shell title="Атрибуты">
        <p className="text-sm text-pretty text-muted">Выберите файл или папку, а не диск.</p>
      </Shell>
    );
  }
  const boxes: { key: keyof Attrs; title: string }[] = [
    { key: "hidden", title: "Скрытый" },
    { key: "system", title: "Системный" },
    { key: "archive", title: "Архивный" },
    { key: "readonly", title: "Только чтение" },
  ];
  return (
    <Shell title={`Атрибуты — ${node.name}`}>
      {boxes.map((box) => (
        <label key={box.key} className="flex h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-accent"
            checked={attrs[box.key]}
            onChange={(e) => setAttrs({ ...attrs, [box.key]: e.target.checked })}
          />
          {box.title}
        </label>
      ))}
      <p className="text-sm text-pretty text-muted">Скрытый файл останется в образе, но будет помечен в каталоге ISO.</p>
      <Row>
        <button type="button" className={quiet} onClick={closeDialog}>
          Отмена
        </button>
        <button type="button" className={primary} onClick={() => useStudio.getState().applyAttrs(attrs)}>
          Применить
        </button>
      </Row>
    </Shell>
  );
}

function WriteDialog() {
  const nodes = useStudio((s) => s.nodes);
  const media = useStudio((s) => s.media);
  const removable = childrenOf(nodes, PC_ROOT).filter((node) => node.driveKind === "removable");
  const [driveId, setDriveId] = useState<string>(removable[0]?.id ?? "new");
  const [also, setAlso] = useState(true);
  const used = payloadBytes(nodes, IMAGE_ROOT);
  const over = used > mediaById(media).bytes;
  return (
    <Shell title="Записать образ жёсткого диска" wide>
      <p className="text-sm text-pretty text-muted">
        Образ собирается в ISO и кладётся на виртуальный USB в нижнем окне. Файл можно скачать и записать на флешку штатной программой Windows. Реальный порт USB из браузера недоступен.
      </p>
      <label className={labelCls} htmlFor="usb">
        Целевой носитель
      </label>
      <select id="usb" className={field} value={driveId} onChange={(e) => setDriveId(e.target.value)}>
        {removable.map((drive) => (
          <option key={drive.id} value={drive.id}>
            {drive.name}
          </option>
        ))}
        <option value="new">Новая флешка H: USB-HDD</option>
      </select>
      <label className="flex h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="accent-accent" checked={also} onChange={(e) => setAlso(e.target.checked)} />
        Также скачать готовый ISO
      </label>
      {over && <p className="text-sm text-danger">Образ больше выбранной болванки ({mediaById(media).label}). На флешку 32 ГБ он всё ещё может поместиться.</p>}
      <Row>
        <button type="button" className={quiet} onClick={closeDialog}>
          Отмена
        </button>
        <button type="button" className={primary} onClick={() => void useStudio.getState().writeTo(driveId, also)}>
          Записать
        </button>
      </Row>
    </Shell>
  );
}

function BurnDialog() {
  const nodes = useStudio((s) => s.nodes);
  const media = useStudio((s) => s.media);
  const optical = childrenOf(nodes, PC_ROOT).filter((node) => node.driveKind === "optical");
  const [driveId, setDriveId] = useState<string>(optical[0]?.id ?? "new");
  const used = payloadBytes(nodes, IMAGE_ROOT);
  const cap = mediaById(media).bytes;
  return (
    <Shell title="Запись CD/DVD">
      <p className="text-sm text-pretty text-muted">
        Запись идёт на виртуальный привод в этом компьютере. ISO одновременно скачивается — его можно прожечь в Windows.
      </p>
      <label className={labelCls} htmlFor="opt">
        Привод
      </label>
      <select id="opt" className={field} value={driveId} onChange={(e) => setDriveId(e.target.value)}>
        {optical.map((drive) => (
          <option key={drive.id} value={drive.id}>
            {drive.name}
          </option>
        ))}
        <option value="new">Новый DVD-R G:</option>
      </select>
      <p className={`text-sm ${used > cap ? "text-danger" : "text-muted"}`}>
        Размер образа {formatBytes(used)} из {formatBytes(cap)} ({mediaById(media).label}).
      </p>
      <Row>
        <button type="button" className={quiet} onClick={closeDialog}>
          Отмена
        </button>
        <button
          type="button"
          className={primary}
          onClick={() => {
            if (used > cap) {
              useStudio.getState().notify("Образ не влезет на выбранную болванку.");
              return;
            }
            void useStudio.getState().burnTo(driveId);
          }}
        >
          Записать
        </button>
      </Row>
    </Shell>
  );
}

function BootDialog() {
  return (
    <Shell title="Загрузочный файл" wide>
      <p className="text-sm text-pretty text-muted">
        Выделите boot-сектор в образе или на компьютере и вшейте его. Либо создайте новый сектор BIOS — он ляжет в папку boot и станет каталогом El Torito.
      </p>
      <div className="grid gap-2">
        <button type="button" className={quiet} onClick={() => useStudio.getState().loadBootFrom("image")}>
          Взять выделенный файл из образа
        </button>
        <button type="button" className={quiet} onClick={() => useStudio.getState().loadBootFrom("pc")}>
          Взять выделенный файл с компьютера
        </button>
        <button type="button" className={primary} onClick={() => useStudio.getState().makeBoot()}>
          Создать загрузочный сектор
        </button>
      </div>
    </Shell>
  );
}

function ChecksumDialog() {
  const dialog = useStudio((s) => s.dialog);
  if (dialog?.type !== "checksum") return null;
  const rows = [
    ["MD5", dialog.md5],
    ["SHA-1", dialog.sha1],
    ["SHA-256", dialog.sha256],
    ["CRC32", dialog.crc],
  ];
  return (
    <Shell title="Контрольные суммы" wide>
      <p className="text-sm">
        {dialog.name} · {formatBytes(dialog.size)}
      </p>
      {rows.map(([name, value]) => (
        <div key={name} className="border border-line bg-inset p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">{name}</span>
            <button
              type="button"
              className="text-xs text-accent"
              onClick={() => {
                void navigator.clipboard.writeText(value).then(() => useStudio.getState().notify(`${name} скопирован.`));
              }}
            >
              Копировать
            </button>
          </div>
          <p className="font-mono text-xs break-all">{value}</p>
        </div>
      ))}
    </Shell>
  );
}

function ConvertDialog() {
  const [openAfter, setOpenAfter] = useState(true);
  return (
    <Shell title="Конвертация">
      <p className="text-sm text-pretty text-muted">NRG, BIN/IMG, MDF и ISZ приводятся к ISO. Префикс заголовка чужого формата отрезается, содержимое сохраняется.</p>
      <label className="flex h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="accent-accent" checked={openAfter} onChange={(e) => setOpenAfter(e.target.checked)} />
        Открыть результат в студии
      </label>
      <label className={`${primary} inline-flex items-center justify-center`}>
        Выбрать файл
        <input
          type="file"
          className="sr-only"
          accept=".iso,.isz,.nrg,.mdf,.img,.bin,.cue"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void useStudio.getState().convertAndOpen(file, openAfter);
          }}
        />
      </label>
    </Shell>
  );
}

function IszDialog() {
  return (
    <Shell title="Сжатие ISZ">
      <p className="text-sm text-pretty text-muted">Образ собирается и упаковывается zlib блоками по 64 КБ. Полученный .isz можно снова открыть через «Открыть» или «Конвертировать».</p>
      <Row>
        <button type="button" className={quiet} onClick={closeDialog}>
          Отмена
        </button>
        <button type="button" className={primary} onClick={() => void useStudio.getState().compressIsz()}>
          Сжать и скачать
        </button>
      </Row>
    </Shell>
  );
}

function OptionsDialog() {
  const options = useStudio((s) => s.options);
  const setOptions = useStudio((s) => s.setOptions);
  const setAssociation = useStudio((s) => s.setAssociation);
  const keys = Object.keys(options.associations) as (keyof AppOptions["associations"])[];
  return (
    <Shell title="Настройки" wide>
      <label className={labelCls} htmlFor="letter">
        Буква виртуального привода ISODrive
      </label>
      <select id="letter" className={field} value={options.driveLetter} onChange={(e) => setOptions({ driveLetter: e.target.value })}>
        {["Z", "Y", "X", "W", "V"].map((letter) => (
          <option key={letter} value={letter}>
            {letter}:
          </option>
        ))}
      </select>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="accent-accent" checked={options.autoMount} onChange={(e) => setOptions({ autoMount: e.target.checked })} />
        Монтировать образ сразу после открытия
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="accent-accent" checked={options.contextMenu} onChange={(e) => setOptions({ contextMenu: e.target.checked })} />
        Контекстное меню в списках файлов
      </label>
      <p className={labelCls}>Ассоциации, которые принимает «Открыть»</p>
      <div className="grid grid-cols-2 gap-1">
        {keys.map((key) => (
          <label key={key} className="flex h-11 items-center gap-2 text-sm uppercase">
            <input type="checkbox" className="accent-accent" checked={options.associations[key]} onChange={(e) => setAssociation(key, e.target.checked)} />
            .{key}
          </label>
        ))}
      </div>
      <p className="text-sm text-pretty text-muted">
        В Windows эти ассоциации прописываются в реестр. Здесь можно скачать шаблон .reg — его применяют на 64-битной системе вручную, браузер сам реестр не меняет.
      </p>
      <Row>
        <button
          type="button"
          className={quiet}
          onClick={() => {
            const lines = [
              "Windows Registry Editor Version 5.00",
              "",
              "[HKEY_CLASSES_ROOT\\.iso]",
              '@="Arca.Image"',
              "",
              "[HKEY_CLASSES_ROOT\\Arca.Image]",
              '@="Образ диска Арка"',
              "",
              "[HKEY_CLASSES_ROOT\\Arca.Image\\shell\\open\\command]",
              '@="\\"C:\\\\Program Files\\\\Arca\\\\Arca.exe\\" \\"%1\\""',
              "",
            ];
            for (const key of keys) {
              if (!options.associations[key] || key === "iso") continue;
              lines.push(`[HKEY_CLASSES_ROOT\\.${key}]`, '@="Arca.Image"', "");
            }
            if (options.contextMenu) {
              lines.push(
                "[HKEY_CLASSES_ROOT\\*\\shell\\ArcaAdd]",
                '@="Добавить в образ Арка"',
                "",
                "[HKEY_CLASSES_ROOT\\*\\shell\\ArcaAdd\\command]",
                '@="\\"C:\\\\Program Files\\\\Arca\\\\Arca.exe\\" /add \\"%1\\""',
                "",
              );
            }
            const text = lines.join("\r\n");
            downloadBlob(new Blob([text]), "arca-associations.reg");
          }}
        >
          Скачать .reg
        </button>
        <button type="button" className={primary} onClick={closeDialog}>
          Готово
        </button>
      </Row>
    </Shell>
  );
}

function FromDiscDialog() {
  const nodes = useStudio((s) => s.nodes);
  const list = childrenOf(nodes, PC_ROOT).filter((node) => node.kind === "drive");
  return (
    <Shell title="Создать образ с диска">
      <p className="text-sm text-pretty text-muted">Содержимое выбранного диска копируется в новый проект. Компакт-диск и смонтированный образ тоже подходят.</p>
      <div className="grid gap-2">
        {list.map((drive) => (
          <button key={drive.id} type="button" className={`${quiet} text-left`} onClick={() => useStudio.getState().imageFromDrive(drive.id)}>
            {drive.name}
            <span className="mt-0.5 block text-xs text-muted">{drive.capacity ? formatBytes(drive.capacity) : "диск"}</span>
          </button>
        ))}
      </div>
    </Shell>
  );
}

function AboutDialog() {
  return (
    <Shell title="О программе">
      <p className="text-sm text-pretty">
        Арка собирает и правит образы дисков: ISO 9660, Joliet и UDF, каталог El Torito, контрольные суммы, конвертация NRG, BIN, MDF и сжатие ISZ.
      </p>
      <p className="text-sm text-pretty text-muted">
        Верхние окна — образ, нижние — компьютер. Файлы переносятся перетаскиванием. Запись на физическую флешку из браузера недоступна: образ скачивается, а в студии появляется виртуальный диск. Проект собирается на Windows x64 в GitHub Actions.
      </p>
    </Shell>
  );
}

function SaveAsDialog() {
  const fileName = useStudio((s) => s.project.fileName);
  const [name, setName] = useState(fileName);
  return (
    <Shell title="Сохранить как">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void useStudio.getState().save(name);
        }}
      >
        <label className={labelCls} htmlFor="fname">
          Имя файла
        </label>
        <input id="fname" className={field} value={name} onChange={(e) => setName(e.target.value)} />
        <Row>
          <button type="button" className={quiet} onClick={closeDialog}>
            Отмена
          </button>
          <button type="submit" className={primary}>
            Собрать ISO
          </button>
        </Row>
      </form>
    </Shell>
  );
}

function TextDialog() {
  const dialog = useStudio((s) => s.dialog);
  if (dialog?.type !== "text") return null;
  return (
    <Shell title={dialog.title} wide>
      <pre className="max-h-80 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">{dialog.body}</pre>
      <Row>
        <button type="button" className={primary} onClick={closeDialog}>
          Закрыть
        </button>
      </Row>
    </Shell>
  );
}

function ConfirmDialog() {
  const dialog = useStudio((s) => s.dialog);
  if (dialog?.type !== "confirm") return null;
  return (
    <Shell title={dialog.title}>
      <p className="text-sm text-pretty">{dialog.body}</p>
      <Row>
        <button type="button" className={quiet} onClick={closeDialog}>
          Отмена
        </button>
        <button type="button" className={primary} onClick={() => useStudio.getState().confirmPending()}>
          {dialog.ok}
        </button>
      </Row>
    </Shell>
  );
}

function WarningsDialog() {
  const dialog = useStudio((s) => s.dialog);
  if (dialog?.type !== "warnings") return null;
  return (
    <Shell title="Предупреждения сборки" wide>
      <ul className="grid gap-2">
        {dialog.lines.map((line) => (
          <li key={line} className="border border-line bg-inset px-3 py-2 text-sm text-pretty">
            {line}
          </li>
        ))}
      </ul>
      <Row>
        <button type="button" className={primary} onClick={closeDialog}>
          Понятно
        </button>
      </Row>
    </Shell>
  );
}

function ProgressDialog() {
  const dialog = useStudio((s) => s.dialog);
  if (dialog?.type !== "progress") return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg/80 p-3">
      <div role="dialog" aria-modal="true" aria-label={dialog.title} className="w-full max-w-sm border border-line bg-surface p-4">
        <h2 className="text-sm font-medium">{dialog.title}</h2>
        <p className="mt-1 truncate font-mono text-xs text-muted">{dialog.detail}</p>
        <div className="mt-3 h-2 overflow-hidden bg-inset">
          <div className="arca-indet h-full w-1/3 bg-accent" />
        </div>
      </div>
    </div>
  );
}

export function StudioDialogs() {
  const dialog = useStudio((s) => s.dialog);
  useEffect(() => {
    if (!dialog || dialog.type === "progress") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);
  if (!dialog) return null;
  if (dialog.type === "properties") return <Properties />;
  if (dialog.type === "new-folder") return <NameDialog title="Новая папка" initial="Новая папка" submit={(name) => useStudio.getState().newFolder(name)} />;
  if (dialog.type === "rename") {
    const node = selectedNode();
    if (!node) {
      return (
        <Shell title="Переименовать">
          <p className="text-sm text-muted">Сначала выберите файл или папку.</p>
        </Shell>
      );
    }
    return <NameDialog title="Переименовать" initial={node.name} submit={(name) => useStudio.getState().rename(name)} />;
  }
  if (dialog.type === "attrs") return <AttrsDialog />;
  if (dialog.type === "write") return <WriteDialog />;
  if (dialog.type === "burn") return <BurnDialog />;
  if (dialog.type === "boot-load") return <BootDialog />;
  if (dialog.type === "checksum") return <ChecksumDialog />;
  if (dialog.type === "convert") return <ConvertDialog />;
  if (dialog.type === "isz") return <IszDialog />;
  if (dialog.type === "options") return <OptionsDialog />;
  if (dialog.type === "from-disc") return <FromDiscDialog />;
  if (dialog.type === "about") return <AboutDialog />;
  if (dialog.type === "save-as") return <SaveAsDialog />;
  if (dialog.type === "text") return <TextDialog />;
  if (dialog.type === "confirm") return <ConfirmDialog />;
  if (dialog.type === "warnings") return <WarningsDialog />;
  if (dialog.type === "progress") return <ProgressDialog />;
  return null;
}
