Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '../src/assets'
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$body = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(8,8,240,240),[System.Drawing.ColorTranslator]::FromHtml('#514969'),[System.Drawing.ColorTranslator]::FromHtml('#101723'),60)
$eyes = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new(40,80,175,105),[System.Drawing.ColorTranslator]::FromHtml('#d6e7ff'),[System.Drawing.ColorTranslator]::FromHtml('#75a0e1'),75)
$border = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#766d97')),2
$pupils = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#080e1d'))
$light = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#edf7ff'))
$star = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#b9a3dc'))
$graphics.FillEllipse($body,8,8,240,240)
$graphics.DrawEllipse($border,9,9,238,238)
$graphics.FillEllipse($eyes,44,80,78,102)
$graphics.FillEllipse($eyes,134,80,78,102)
$graphics.FillEllipse($pupils,76,103,40,70)
$graphics.FillEllipse($pupils,142,103,40,70)
$graphics.FillEllipse($light,82,109,12,17)
$graphics.FillEllipse($light,148,109,12,17)
$graphics.FillEllipse($light,100,152,5,8)
$graphics.FillEllipse($light,166,152,5,8)
$graphics.DrawArc($border,115,186,26,14,0,180)
$points = [System.Drawing.PointF[]]@([System.Drawing.PointF]::new(128,35),[System.Drawing.PointF]::new(132,47),[System.Drawing.PointF]::new(143,51),[System.Drawing.PointF]::new(132,55),[System.Drawing.PointF]::new(128,67),[System.Drawing.PointF]::new(124,55),[System.Drawing.PointF]::new(113,51),[System.Drawing.PointF]::new(124,47))
$graphics.FillPolygon($star,$points)
$bitmap.Save((Join-Path $assetDirectory 'icon.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$memory = New-Object System.IO.MemoryStream
$bitmap.Save($memory,[System.Drawing.Imaging.ImageFormat]::Png)
$bytes = $memory.ToArray()
$stream = [System.IO.File]::Create((Join-Path $assetDirectory 'icon.ico'))
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$bytes.Length); $writer.Write([uint32]22)
$writer.Write($bytes)
$writer.Dispose(); $memory.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $body.Dispose(); $eyes.Dispose(); $border.Dispose()
$pupils.Dispose(); $light.Dispose(); $star.Dispose()
