import { blobOf } from "@/lib/iso/bytes";
import { makeBootSector } from "@/lib/iso/boot";
import { DEFAULT_ATTRS, IMAGE_ROOT, PC_ROOT, type Attrs, type FsNode } from "./types";

const T = Date.UTC(2026, 10, 9, 1, 0, 0);

function attrs(patch?: Partial<Attrs>): Attrs {
  return { ...DEFAULT_ATTRS, ...patch };
}

function textFile(id: string, parentId: string, name: string, text: string, patch?: Partial<Attrs>): FsNode {
  const data = new TextEncoder().encode(text);
  return {
    id,
    parentId,
    name,
    kind: "file",
    size: data.length,
    attrs: attrs(patch),
    mtime: T,
    blob: new Blob([data]),
  };
}

function dir(id: string, parentId: string | null, name: string, extra: Partial<FsNode> = {}): FsNode {
  return {
    id,
    parentId,
    name,
    kind: extra.kind ?? "dir",
    size: 0,
    attrs: attrs(),
    mtime: T,
    ...extra,
  };
}

export function createSeed(): Record<string, FsNode> {
  const boot = makeBootSector("ARCA BOOT OK");
  const nodes: Record<string, FsNode> = {
    [IMAGE_ROOT]: dir(IMAGE_ROOT, null, "ARCA_DEMO"),
    "img-readme": textFile(
      "img-readme",
      IMAGE_ROOT,
      "readme.txt",
      "Арка — мастер образов.\r\nВерхние окна — содержимое ISO, нижние — компьютер.\r\nПеретащите файлы снизу вверх, чтобы добавить их в образ.\r\nФайл → Свойства задаёт ISO 9660, Joliet или UDF.\r\nСамозагрузка записывает образ на USB и хранит загрузочный сектор.\r\n",
    ),
    "img-autorun": textFile(
      "img-autorun",
      IMAGE_ROOT,
      "autorun.inf",
      "[autorun]\r\nopen=sources\\setup.txt\r\nlabel=ARCA_DEMO\r\n",
    ),
    "img-docs": dir("img-docs", IMAGE_ROOT, "Документы"),
    "img-hello": textFile(
      "img-hello",
      "img-docs",
      "Приветствие.txt",
      "Длинное имя на кириллице. В режиме Joliet и UDF оно сохранится, в чистом ISO 9660 станет 8.3.\r\n",
    ),
    "img-bootdir": dir("img-bootdir", IMAGE_ROOT, "boot"),
    "img-boot": {
      id: "img-boot",
      parentId: "img-bootdir",
      name: "etfsboot.bin",
      kind: "file",
      size: boot.length,
      attrs: attrs({ system: true }),
      mtime: T,
      blob: blobOf(boot),
      boot: true,
    },
    "img-sources": dir("img-sources", IMAGE_ROOT, "sources"),
    "img-setup": textFile("img-setup", "img-sources", "setup.txt", "Демонстрационный установщик. Замените файл своим bootmgr или setup.exe.\r\n"),

    [PC_ROOT]: dir(PC_ROOT, null, "Этот компьютер"),
    "drv-c": dir("drv-c", PC_ROOT, "C: Система", { kind: "drive", driveKind: "fixed", capacity: 256 * 1024 ** 3 }),
    "c-users": dir("c-users", "drv-c", "Пользователи"),
    "c-docs": dir("c-docs", "c-users", "Документы"),
    "c-note": textFile("c-note", "c-docs", "Заметки.txt", "Локальный файл. Перетащите его в верхнее правое окно — он попадёт в образ.\r\n"),
    "c-plan": textFile("c-plan", "c-docs", "План.txt", "1. Собрать папку sources\r\n2. Вшить загрузочный сектор\r\n3. Проверить, что образ влезает на DVD\r\n"),
    "c-win": dir("c-win", "drv-c", "Windows"),
    "c-win-readme": textFile("c-win-readme", "c-win", "readme.txt", "Системная папка виртуального диска C:.\r\n"),
    "drv-d": dir("drv-d", PC_ROOT, "D: Данные", { kind: "drive", driveKind: "fixed", capacity: 512 * 1024 ** 3 }),
    "d-dist": dir("d-dist", "drv-d", "Дистрибутив"),
    "d-auto": textFile("d-auto", "d-dist", "autorun.inf", "[autorun]\r\nlabel=DATA\r\n"),
    "d-install": textFile("d-install", "d-dist", "install.txt", "Каталог, с которого можно собрать новый образ через «Создать образ с диска».\r\n"),
    "d-music": dir("d-music", "drv-d", "Музыка"),
    "d-m3u": textFile("d-m3u", "d-music", "playlist.m3u", "#EXTM3U\r\n#EXTINF:12,Пример\r\ntrack.wav\r\n"),
    "drv-e": dir("drv-e", PC_ROOT, "E: USB", { kind: "drive", driveKind: "removable", capacity: 16 * 1024 ** 3 }),
    "e-label": textFile("e-label", "drv-e", "метка.txt", "Съёмный диск на 16 ГБ. Сюда «Записать образ» кладёт файлы с ISO.\r\n"),
    "drv-f": dir("drv-f", PC_ROOT, "F: CD-ROM", { kind: "drive", driveKind: "optical", capacity: 700 * 1024 * 1024 }),
    "f-readme": textFile("f-readme", "drv-f", "README.TXT", "Виртуальный компакт-диск. С него можно снять ISO.\r\n"),
    "f-data": dir("f-data", "drv-f", "DATA"),
    "f-info": textFile("f-info", "f-data", "info.txt", "Сектор демо-диска.\r\n"),
  };
  return nodes;
}
