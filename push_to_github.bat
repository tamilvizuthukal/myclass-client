@echo off
echo Adding changes...
git add .

set /p commit_msg="Enter commit message (default: Update): "
if "%commit_msg%"=="" set commit_msg=Update

echo Committing changes...
git commit -m "%commit_msg%"

echo Pushing to https://github.com/dsavio83/myclass.git...
git push https://github.com/dsavio83/myclass.git main

echo Done!
pause
