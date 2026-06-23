@echo off
setlocal

REM zeen-tools local preview stopper (ASCII-only)
REM Kills node processes running local-preview-server.js and frees ports 8091-8095.

echo ==============================================
echo   GaoKao Score Time Machine - Stop Preview
echo ==============================================
echo.

echo [1/2] Stopping preview server (local-preview-server.js)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and ($_.CommandLine -like '*local-preview-server.js*' -or $_.CommandLine -like '*gk-time-machine-preview*') }; if (-not $p) { Write-Host '  No running preview server found.' } else { $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('  Stopped PID: ' + $_.ProcessId) } }"

echo.
echo [2/2] Freeing ports 8091-8095...
powershell -NoProfile -Command "foreach ($port in 8091,8092,8093,8094,8095) { $c = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue; if ($c) { $c | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('  Port ' + $port + ' freed (PID ' + $_ + ')') } } }; Write-Host '  Port check done.'"

echo.
echo DONE. Close the browser tab if still open.
echo.
pause
endlocal
