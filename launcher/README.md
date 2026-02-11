# HighElf Launcher
DEV BUILD

> [!WARNING]
> This launcher setup / whole project is intended for devs only<br>
> It's not meant for end users to just download and use<br>
> End users will have to wait for real launcher support from other projects<br>

This launcher is intended for devs of HighElf to get setup and working with the server<br>
It handles all the account auth and token passing needed to launch the game properly.<br>
This launcher WILL NOT download, patch or crack game files. However I do have some bat scripts... if you can find the files your self.. not helping with that sorry.

This project does also contain basic configs for the HighElf proxy tools as well however, once again these tools are meant for devs only<br>
The proxy is only needed for dev and testing, until proper patches are made to the real game to reroute traffic so proxies are not needed.

# Pre-reqs
urr python. and this guide is for windows, but your smart you'll figure it out for other os'es
Your pwr patch files must be labled corecly for the installer to work. `v1-windows-amd64.pwr` or `v0~1-windows-amd64.pwr`

# Setup
- Make a new folder somewhere like `D:/Games/HyTale`
- Download the `utils` folder and `InstallReleaseBuild.bat` to here
- Add the `butler.exe`, `7z.dll` and `c7zip.dll` files to this `utils` folder
- Drag and drop a release pwr patch file to the `InstallReleaseBuild.bat` script
- TODO: Download and run proxy
- Now you can run the launcher with `python launcher.py -c launcher/build-8.json`
- As `token.json` does not excist yet, you will be propted to login to HighElf
- After you login a default `token.json` will be made and you can now use that token again. You will have to login again, but your email will be saved to reuse.<br>
(`"stayLoggedIn": true` can be configed in your profile settings to "stay logged in" so you just need the token to login, you wont need enter any account details, unless you move your token to a new computer)
