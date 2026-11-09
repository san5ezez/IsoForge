using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace UltraISOStudio.UI
{
    /// <summary>
    /// Programmatically renders crisp 24x24 & 16x16 vector-styled GDI+ icons for the Toolbar and TreeView/ListView
    /// matching all requested icon motifs:
    /// - Clean Sheet (Create)
    /// - Folder (Open)
    /// - Floppy Disk (Save / Save As)
    /// - Folder with Plus (Add to ISO)
    /// - Folder with Minus (Extract from ISO)
    /// - Disc with Drive (Make ISO from physical drive)
    /// - Disc with Flame (Burn ISO to CD/DVD)
    /// - Disc with Gear (Mount to Virtual Drive)
    /// - Disc with Vice/Clamp (Compress to ISZ)
    /// - Two Discs (Format Converter MDF/NRG/IMG -> ISO)
    /// </summary>
    public static class IconFactory
    {
        public static Bitmap CreateCleanSheetIcon(int size = 24)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);
            var rect = new Rectangle(4, 2, size - 8, size - 4);
            using var fill = new LinearGradientBrush(rect, Color.White, Color.FromArgb(225, 235, 248), 45f);
            using var pen = new Pen(Color.FromArgb(70, 100, 140), 1.5f);
            g.FillRectangle(fill, rect);
            g.DrawRectangle(pen, rect);
            // Folded corner
            g.DrawLine(pen, size - 9, 2, size - 4, 7);
            return bmp;
        }

        public static Bitmap CreateFolderIcon(int size = 24, int badgeMode = 0) // 0 = normal, 1 = plus, -1 = minus
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);

            var tabRect = new Rectangle(2, 4, 9, 4);
            var bodyRect = new Rectangle(2, 7, size - 5, size - 10);
            using var brush = new LinearGradientBrush(bodyRect, Color.FromArgb(255, 224, 130), Color.FromArgb(245, 166, 35), 90f);
            using var pen = new Pen(Color.FromArgb(180, 115, 10), 1.4f);

            g.FillRectangle(brush, tabRect);
            g.DrawRectangle(pen, tabRect);
            g.FillRectangle(brush, bodyRect);
            g.DrawRectangle(pen, bodyRect);

            if (badgeMode != 0)
            {
                var badgeRect = new Rectangle(size - 12, size - 12, 10, 10);
                Color badgeColor = badgeMode > 0 ? Color.FromArgb(34, 153, 84) : Color.FromArgb(203, 67, 53);
                using var bBrush = new SolidBrush(badgeColor);
                using var wPen = new Pen(Color.White, 1.8f);
                g.FillEllipse(bBrush, badgeRect);
                int cx = badgeRect.X + 5;
                int cy = badgeRect.Y + 5;
                g.DrawLine(wPen, cx - 3, cy, cx + 3, cy);
                if (badgeMode > 0)
                    g.DrawLine(wPen, cx, cy - 3, cx, cy + 3);
            }
            return bmp;
        }

        public static Bitmap CreateFloppyIcon(int size = 24, bool saveAsBadge = false)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);
            var body = new Rectangle(3, 3, size - 6, size - 6);
            using var bodyBrush = new LinearGradientBrush(body, Color.FromArgb(52, 116, 212), Color.FromArgb(27, 79, 156), 45f);
            using var borderPen = new Pen(Color.FromArgb(20, 55, 115), 1.4f);
            g.FillRectangle(bodyBrush, body);
            g.DrawRectangle(borderPen, body);

            // Shutter & label
            g.FillRectangle(Brushes.WhiteSmoke, new Rectangle(6, 3, size - 12, 6));
            g.FillRectangle(Brushes.White, new Rectangle(5, 12, size - 10, size - 15));

            if (saveAsBadge)
            {
                using var penBrush = new SolidBrush(Color.FromArgb(243, 156, 18));
                g.FillEllipse(penBrush, size - 10, size - 10, 8, 8);
                g.DrawEllipse(Pens.DarkRed, size - 10, size - 10, 8, 8);
            }
            return bmp;
        }

        public static Bitmap CreateDiscBase(int size = 24, Rectangle? customRect = null)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);
            DrawDiscOnGraphics(g, customRect ?? new Rectangle(2, 2, size - 5, size - 5));
            return bmp;
        }

        private static void DrawDiscOnGraphics(Graphics g, Rectangle discRect)
        {
            using var brush = new LinearGradientBrush(discRect, Color.FromArgb(180, 225, 255), Color.FromArgb(95, 165, 235), 45f);
            using var pen = new Pen(Color.FromArgb(55, 110, 170), 1.3f);
            g.FillEllipse(brush, discRect);
            g.DrawEllipse(pen, discRect);

            int holeSize = Math.Max(4, discRect.Width / 4);
            var holeRect = new Rectangle(
                discRect.X + (discRect.Width - holeSize) / 2,
                discRect.Y + (discRect.Height - holeSize) / 2,
                holeSize,
                holeSize);
            g.FillEllipse(Brushes.White, holeRect);
            g.DrawEllipse(pen, holeRect);
        }

        public static Bitmap CreateDiscWithDriveIcon(int size = 24)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);

            // Drive tray at bottom
            var tray = new Rectangle(2, size - 9, size - 4, 6);
            using var trayBrush = new SolidBrush(Color.FromArgb(90, 98, 110));
            g.FillRectangle(trayBrush, tray);
            g.DrawRectangle(Pens.DarkSlateGray, tray);
            g.FillRectangle(Brushes.LimeGreen, size - 7, size - 7, 3, 2);

            // Disc above drive
            DrawDiscOnGraphics(g, new Rectangle(4, 1, size - 8, size - 9));
            return bmp;
        }

        public static Bitmap CreateDiscWithFlameIcon(int size = 24)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);
            DrawDiscOnGraphics(g, new Rectangle(2, 2, size - 6, size - 6));

            // Flame overlay in bottom-right
            Point[] outerFlame =
            {
                new Point(size - 9, size - 2),
                new Point(size - 12, size - 8),
                new Point(size - 7, size - 14),
                new Point(size - 2, size - 8),
                new Point(size - 4, size - 2)
            };
            using var flameBrush = new LinearGradientBrush(
                new Rectangle(size - 12, size - 14, 11, 13),
                Color.FromArgb(255, 215, 0),
                Color.FromArgb(220, 40, 20),
                90f);
            g.FillPolygon(flameBrush, outerFlame);
            using var redPen = new Pen(Color.FromArgb(165, 25, 10), 1f);
            g.DrawPolygon(redPen, outerFlame);
            return bmp;
        }

        public static Bitmap CreateDiscWithGearIcon(int size = 24)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);
            DrawDiscOnGraphics(g, new Rectangle(2, 2, size - 6, size - 6));

            // Gear in bottom-right
            var gearRect = new Rectangle(size - 12, size - 12, 9, 9);
            using var gearPen = new Pen(Color.FromArgb(40, 90, 150), 2.2f);
            gearPen.DashStyle = DashStyle.Dot;
            g.DrawEllipse(gearPen, gearRect);
            using var gearFill = new SolidBrush(Color.FromArgb(70, 130, 190));
            g.FillEllipse(gearFill, size - 10, size - 10, 5, 5);
            return bmp;
        }

        public static Bitmap CreateDiscWithClampIcon(int size = 24)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);
            DrawDiscOnGraphics(g, new Rectangle(4, 4, size - 8, size - 8));

            // Vice / Clamp jaws top and bottom
            using var clampPen = new Pen(Color.FromArgb(142, 68, 173), 2.2f);
            g.DrawLine(clampPen, 3, 2, size - 3, 2);
            g.DrawLine(clampPen, 3, size - 3, size - 3, size - 3);
            g.DrawLine(clampPen, 4, 2, 4, 6);
            g.DrawLine(clampPen, size - 5, 2, size - 5, 6);
            g.DrawLine(clampPen, 4, size - 3, 4, size - 7);
            g.DrawLine(clampPen, size - 5, size - 3, size - 5, size - 7);
            return bmp;
        }

        public static Bitmap CreateTwoDiscsIcon(int size = 24)
        {
            var bmp = new Bitmap(size, size);
            using var g = InitGraphics(bmp);
            DrawDiscOnGraphics(g, new Rectangle(1, 1, size - 10, size - 10));
            DrawDiscOnGraphics(g, new Rectangle(8, 8, size - 10, size - 10));
            return bmp;
        }

        public static Bitmap CreateFileItemIcon(int size = 16)
        {
            return CreateCleanSheetIcon(size);
        }

        public static Bitmap CreateDriveItemIcon(int size = 16)
        {
            return CreateDiscWithDriveIcon(size);
        }

        private static Graphics InitGraphics(Bitmap bmp)
        {
            var g = Graphics.FromImage(bmp);
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.Clear(Color.Transparent);
            return g;
        }
    }

    /// <summary>
    /// Custom graphical capacity gauge bar for the bottom Status Bar:
    /// Renders used MB/GB vs selected target media capacity (CD 700MB, DVD 4.7GB, DVD 8.5GB)
    /// and turns red when capacity is exceeded.
    /// </summary>
    public class CapacityMeterControl : Control
    {
        public long UsedBytes { get; set; }
        public long MaxBytes { get; set; } = 700L * 1024 * 1024;
        public string MediaLabel { get; set; } = "CD 700MB";
        public bool IsOverCapacity => UsedBytes > MaxBytes && MaxBytes > 0;

        public CapacityMeterControl()
        {
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);
            Size = new Size(340, 20);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;

            var rect = new Rectangle(0, 0, Width - 1, Height - 1);
            using var bgBrush = new SolidBrush(Color.FromArgb(240, 243, 247));
            g.FillRectangle(bgBrush, rect);

            double ratio = MaxBytes > 0 ? (double)UsedBytes / MaxBytes : 0.0;
            double clamped = Math.Clamp(ratio, 0.0, 1.0);
            int fillWidth = (int)((Width - 2) * clamped);

            if (fillWidth > 0)
            {
                var fillRect = new Rectangle(1, 1, fillWidth, Height - 2);
                Color c1, c2;
                if (ratio > 1.0)
                {
                    c1 = Color.FromArgb(231, 76, 60);
                    c2 = Color.FromArgb(192, 57, 43);
                }
                else if (ratio > 0.90)
                {
                    c1 = Color.FromArgb(243, 156, 18);
                    c2 = Color.FromArgb(211, 84, 0);
                }
                else
                {
                    c1 = Color.FromArgb(46, 204, 113);
                    c2 = Color.FromArgb(39, 174, 96);
                }

                using var barBrush = new LinearGradientBrush(fillRect, c1, c2, 90f);
                g.FillRectangle(barBrush, fillRect);
            }

            // Draw subtle ruler ticks at 25%, 50%, 75%
            using var tickPen = new Pen(Color.FromArgb(180, 190, 205), 1f);
            for (int t = 1; t <= 3; t++)
            {
                int tx = (Width * t) / 4;
                g.DrawLine(tickPen, tx, Height - 5, tx, Height - 1);
            }

            using var borderPen = new Pen(ratio > 1.0 ? Color.DarkRed : Color.FromArgb(150, 160, 175), 1f);
            g.DrawRectangle(borderPen, rect);

            string sizeText = FormatSize(UsedBytes) + " / " + FormatSize(MaxBytes) + $" ({ratio * 100:0.0}%)";
            if (ratio > 1.0)
                sizeText = "ПЕРЕПОЛНЕНИЕ: " + sizeText;

            using var font = new Font("Segoe UI", 8.25f, FontStyle.Bold);
            var textSize = g.MeasureString(sizeText, font);
            float txPos = (Width - textSize.Width) / 2f;
            float tyPos = (Height - textSize.Height) / 2f;

            using var textBrush = new SolidBrush(ratio > 0.55 ? Color.White : Color.FromArgb(30, 40, 55));
            if (ratio > 0.55)
            {
                g.DrawString(sizeText, font, Brushes.Black, txPos + 1, tyPos + 1);
            }
            g.DrawString(sizeText, font, textBrush, txPos, tyPos);
        }

        public static string FormatSize(long bytes)
        {
            if (bytes >= 1024L * 1024 * 1024)
                return $"{bytes / (1024.0 * 1024 * 1024):0.00} ГБ";
            return $"{bytes / (1024.0 * 1024.0):0.0} МБ";
        }
    }
}
