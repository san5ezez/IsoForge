# IsoForge

Windows x64 desktop ISO workspace inspired by classic dual-pane ISO editors.

## Build locally
Requires Windows 10/11 and .NET 8 SDK.

```powershell
dotnet restore IsoForge/IsoForge.csproj
dotnet publish IsoForge/IsoForge.csproj -c Release -r win-x64 --self-contained true
```

## GitHub Actions
Push this repository to GitHub. The workflow builds a self-contained Windows x64 ZIP on every push and pull request. Create a tag such as `v0.1.0` to publish a GitHub Release.

## Implemented in this starter
- WPF dual-pane interface with ISO tree/content and local folders/files.
- Open ISO and read files/directories (DiscUtils).
- Add files, drag-and-drop into ISO pane, create directories, rename and delete entries in the working project.
- Rebuild a new ISO using ISO 9660 or Joliet.
- Extract selected file.
- Windows ISO mounting through `Mount-DiskImage`.
- SHA-256 checksum calculation.
- CD/DVD capacity meter.

## Not yet implemented
This is an initial working project foundation, not a complete UltraISO replacement. Direct in-place modification of an existing ISO is implemented as an editable in-memory workspace and rebuild-on-save. UDF creation, El Torito boot catalog writing, raw USB writing, optical-disc burning, physical-disc imaging, ISZ compression and MDF/NRG/IMG conversion are not yet implemented. USB writing is intentionally disabled to avoid accidental data loss.

## License
MIT
