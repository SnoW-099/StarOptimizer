Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path $PSScriptRoot '../src/assets'
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$body = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#11151e'))
$eyes = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#84a9ed'))
$border = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#b6adf8')),5
$graphics.FillEllipse($body,8,8,240,240)
$graphics.DrawEllipse($border,9,9,238,238)
$graphics.FillEllipse($eyes,43,68,79,111)
$graphics.FillEllipse($eyes,133,68,79,111)
$graphics.FillEllipse($body,77,101,37,64)
$graphics.FillEllipse($body,143,101,37,64)
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
