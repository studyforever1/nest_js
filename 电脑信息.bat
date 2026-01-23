@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo =====================================
echo   获取机器硬件信息
echo =====================================
echo.

:: ===== CPU ProcessorId =====
for /f "skip=1 delims=" %%i in ('wmic cpu get ProcessorId') do (
    if not "%%i"=="" (
        set CPU=%%i
        goto :cpu_done
    )
)
:cpu_done

:: ===== Disk SerialNumber (Index=0) =====
for /f "tokens=2 delims==" %%i in ('wmic diskdrive where "Index=0" get SerialNumber /value') do (
    if not "%%i"=="" (
        set DISK=%%i
    )
)

:: ===== BaseBoard SerialNumber =====
for /f "skip=1 delims=" %%i in ('wmic baseboard get SerialNumber') do (
    if not "%%i"=="" (
        set BOARD=%%i
        goto :board_done
    )
)
:board_done

:: ===== 去除空格 =====
set CPU=%CPU: =%
set DISK=%DISK: =%
set BOARD=%BOARD: =%

:: ===== 拼接 RAW =====
set RAW=%CPU%-%DISK%-%BOARD%

echo CPU ProcessorId  : %CPU%
echo Disk SerialNumber: %DISK%
echo Board SerialNumber: %BOARD%
echo.
echo RAW STRING:
echo %RAW%
echo.

pause
