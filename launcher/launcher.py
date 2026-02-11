#!/env/Python3.13.3
#!/user/MobCat (2026)

# "Basic" cracked launcher for HyTale
# Only handles logging into a cracked server like HighElf and multiple client ver loading. So you can test pre-release and release without reinstalling everything.
# This launcher WILL NOT download patch files.
# This launcher may not work with other cracks, as we rely on getting valid token info from HighElf, not just generating new random ones.
# This launcher is more of a POC, it gets the job done for indev. But a real one with a real ui will have to be made for the normies.

# Oh yeah, just make a simple launcher they said, you can make a fancey gui launcher lator....
# Meanwhile the "simple" launcher is like 350+ lines of junk...

import requests, json, subprocess, os, ctypes, base64, hashlib, sys, time, argparse

def decode_base64url(data):
    # Add padding if needed
    padding = 4 - len(data) % 4
    if padding != 4:
        data += '=' * padding
    return base64.urlsafe_b64decode(data)

# fancy ass hide password as typing thingy
def maskPassword(prompt="Password: "):
    print(prompt, end='', flush=True)
    password = ""
    
    # Windows
    try:
        import msvcrt
        while True:
            char = msvcrt.getch()
            if char in (b'\r', b'\n'):
                print()
                return password
            elif char == b'\x08':  # Backspace
                if password:
                    password = password[:-1]
                    sys.stdout.write('\b \b')
                    sys.stdout.flush()
            else:
                password += char.decode('utf-8')
                sys.stdout.write('*')
                sys.stdout.flush()
    except ImportError:
        # Unix/Linux/Mac
        # This is more for lator, as the launcher only works with windows exes lol.
        import tty
        import termios
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            while True:
                char = sys.stdin.read(1)
                if char in ('\n', '\r'):
                    print()
                    return password
                elif char == '\x7f':  # Backspace
                    if password:
                        password = password[:-1]
                        sys.stdout.write('\b \b')
                        sys.stdout.flush()
                else:
                    password += char
                    sys.stdout.write('*')
                    sys.stdout.flush()
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)

def process_exists(process_name):
    call = 'TASKLIST', '/FI', 'imagename eq %s' % process_name
    # use buildin check_output right away
    output = subprocess.check_output(call).decode()
    # check in last line for process name
    last_line = output.strip().split('\r\n')[-1]
    # because Fail message could be translated
    return last_line.lower().startswith(process_name.lower())


def create_parser():
    parser = argparse.ArgumentParser(
        description='HighElf Launcher Help',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python launcher.py -c launcher/game.json
  python launcher.py -c launcher/game.json -t launcher/loginToken.json
  python launcher.py -c new
  python launcher.py -t new
  python launcher.py --config launcher/game.json --token launcher/loginToken.json

if a login token is not provided with -t, the default launcher/token.json will be loaded.
        '''
    )
    
    parser.add_argument(
        '-c', '--config',
        type=str,
        required=False,
        metavar='PATH',
        help='Path to config JSON file, or "-c new" to create a new game config'
    )
    
    parser.add_argument(
        '-t', '--token',
        type=str,
        default='launcher/token.json',
        metavar='PATH',
        help='Path to token JSON file, or "-t new" to create a new login token'
    )
    return parser
########################################################################################################################
print("""
▄▄▄   ▄▄▄           ▄▄     ▄▄▄▄▄▄▄ ▄▄   ▄▄ 
███   ███ ▀▀        ██    ███▀▀▀▀▀ ██  ██  
█████████ ██  ▄████ ████▄ ███▄▄    ██ ▀██▀ 
███▀▀▀███ ██  ██ ██ ██ ██ ███      ██  ██  
███   ███ ██▄ ▀████ ██ ██ ▀███████ ██  ██  
                 ██The HyTale auth server
               ▀▀▀ emulator project""")
print("HighElf launcher - 20260207\n")
if (process_exists('HytaleClient.exe') == True):
    print("HyTale is alrady running\nYou can only run one at once.")
    exit()

# folder to store all our junk in
if (os.path.isdir('launcher') == False):
    os.mkdir('launcher')

# command args pasing
parser = create_parser()

# If no arguments provided, show help
if len(sys.argv) == 1:
    parser.print_help()
    sys.exit(0)

args = parser.parse_args()

if args.config is None or args.config == 'new':
    newConfig = input("Game config json not loaded. Make a new config? [y/N]: ")
    if newConfig == 'n' or newConfig == 'N':
        print('You need to make a config for this launcher to launch HyTale with. Exiting launcher...')
        exit()
    else:
        while True:
            brokenConfig = False
            highElf = input("Enter your HighElf server url. for eg https://randomserver.com/HighElf\n: ")
            authServer = input("\nEnter your auth server url. for eg https://auth.server\n: ")
            appDir = input("\nWhere is HyTale installed? for eg C:\\Users\\MobCat\\AppData\\Roaming\\Hytale\\install\\release\\package\\game\\latest\n: ")
            appDir = str(appDir).replace(os.path.sep, '/')
            userData = input("\nWhere would you like your UserData like world saves and game configs to be saved?\n for eg C:\\Users\\MobCat\\Documents\\HighElf\\UserData\nPlease Note: It is not recommended to share user data folders between retail HyTale and this server emulator. Please use a difrent folder.\n: ")
            userData = str(userData).replace(os.path.sep, '/')
            javaExe = input("\nWhere is java.exe? for eg. C:\\Users\\MobCat\\AppData\\Roaming\\Hytale\\install\\release\\package\\jre\\latest\bin\\java.exe\n: ")
            javaExe = str(javaExe).replace(os.path.sep, '/')
            authMode = input("\nWould you like to use the offline auth mode? [y/N]\nThis auth mode will alow you to run the game without a server emulator like HighElf, but you wont be abale to save any account data, only game saves.\n: ")

            # Ping servers to make sure they are up and you entered the url right.
            url = f"{highElf}/health"
            print(f"\nTesting connectiong to: {url}")
            headers = {"Content-Type": "application/json"}
            response = requests.post(url, headers=headers)
            #print(response.text)
            serverJson = json.loads(response.text)
            if serverJson['status'] == 'ok':
                print(f"Server Name: {serverJson['server']}\nDomain: {serverJson['domain']}")
                if 'HighElf' in serverJson:
                    print(f"HighElf version: {serverJson['HighElf']}")
                else:
                    print(f"ERROR: This server is not a HighElf server. This config will not work and you will not be able to save it.")
                    brokenConfig = True

            url = f"{authServer}/health"
            print(f"\nTesting connectiong to: {url}")
            headers = {"Content-Type": "application/json"}
            response = requests.post(url, headers=headers)
            #print(response.text)
            serverJson = json.loads(response.text)
            if serverJson['status'] == 'ok':
                print(f"Server Name: {serverJson['server']}\nDomain: {serverJson['domain']}")
                if serverJson['domain'] != 'hytale.com':
                    print(f"WARNING: This domain server may not be configuerd corecly for HighElf. for the beta, we are going to invaldate your config. Sorry please try a difrent auth server")
                    brokenConfig = True

            #TODO: Check if we can find Client\HytaleClient.exe and Server\HytaleServer.jar in appDir
            #      Valadate the client and server have not been modifyed
            #TODO: Check for java.exe

            print("\nPlease review your data:")
            authFlag = 'offline' if authMode == 'y' else 'authenticated'
            configData = {'HighElf': highElf, 'TokenAuth': authServer, 'app-dir': appDir, 'user-dir': userData, 'java-exec': javaExe, 'auth-mode': authFlag}

            print(configData)
            print(json.dumps(configData, indent=4))
            if brokenConfig == False:
                isCorect = input("Is this data corect? [y/N]: ")
                if isCorect == 'y':
                    filename = input("What would you like to call this config?: ") 
                    with open(f'launcher/{filename}.json', 'w') as f:
                        json.dump(configData, f, indent = 4, ensure_ascii = False)
                    print(f"Launcher config saved as 'launcher/{filename}.json'\nYou can now use the folow command to login into HighElf and launch Hytale\npython launcher.py launcher/{filename}.json new\nLauncher is continuing as normal meow\n\n")
                    break
                else:
                    print("User did not comfirm the config with y\nRestarting...") 

        with open(f'launcher/{filename}.json') as json_data:
            config = json.load(json_data)
        print(f"Loaded new config: launcher/{filename}.json")

else:
    filepath = args.config
    with open(filepath) as json_data:
        config = json.load(json_data)
    print(f"Loaded game config: {filepath}")


refreshLogin = False
newLogin = False

if args.token is None:
    with open('launcher/token.json') as json_data:
        token = json.load(json_data)
        print("Loaded Default login token launcher/token.json")
        print("Use '-t new' to create a new login token")
    #MOVED: to get the server to check this cos of user settings
    '''
    if (token['ext'] < int(time.time())):
        print("Token expired, please try again")
        refreshLogin = True
    '''
#elif args.token == 'new' or not os.path.isfile('launcher/token.json'):
elif args.token == 'new':
    print("New token");
    refreshLogin = True
    newLogin = True
    token = []
else:
    refreshLogin = False
    filepath = args.token
    if not os.path.isfile(filepath):
        print(f"{filepath} config not found. Lets make a new one.")
        refreshLogin = True
        newLogin = True
        token = []
    else:
        with open(filepath) as json_data:
            token = json.load(json_data)
        print(f"Loaded login token: {filepath}")

if refreshLogin == False: # I um, dont think this is right lol.
    # Send token to server to get session
    url = f"{config['HighElf']}/login/api.php"
    headers = {"Content-Type": "application/json"}
    data = {'uuid': token['uuid'], 'user': token['user'], 'token': token['token']}
    response = requests.post(url, json=data, headers=headers)
    try:
        token = json.loads(response.text)
    except json.decoder.JSONDecodeError:
        print(response.text)
    #print(token)
    #print(response.text)

    if 'error' in token:
        print(f"ERROR: {token['error']}")
        refreshLogin = True

if refreshLogin:
    try:
        print("\nEnter login details")
        if 'email' in token:
            print(f"Email: {token['email']}")
            username = token['email']
        else:
            username = input("Email: ")
        password = maskPassword("Password: ")
        password = hashlib.sha256(password.encode('utf-8')).hexdigest()

        # set filename for -t token to be removed for refresh
        if args.token != 'new':
            filename = args.token
        else:
            filename = 'launcher/token.json'
        if os.path.isfile(filename):
            os.remove(filename)

        url = f"{config['HighElf']}/login/api.php"
        headers = {"Content-Type": "application/json"}
        data = {'email': username, 'password': password}
        response = requests.post(url, json=data, headers=headers)
        #print(response.text)
        token = json.loads(response.text)

        if response.status_code != 200:
            print("ERROR: Cant connect to login server?")
            print(response.text)
            exit()
    except KeyboardInterrupt:
        print("\nLauncher Terminated. goodbye ^__^/")
        exit()

    #TODO: Check if proxy is running


# save user login config if needed.
print(f"\nSuccessfully logged in as {token['user']}\nSession ID: {token['session_id']}\nEntitlements: {token['entitlements']}")
if token['success'] == True:
    tokenData = {"ext": token['ext'],
                 "uuid": token['uuid'],
                 "user": token['user'],
                 "otp": token['otp'],
                 "token": token['launcher_token']
                }
    filename = ''
    if newLogin == True and args.token == 'new':
        filename = input("\nPlease enter a name for you new login token\nor press enter to set default name: ")
        if filename == '':
            filepath = f"launcher/token.json"
        else:
            filepath = f"launcher/{filename}.json"
    else:
        filepath = args.token

    # If we pass in a token that does not excist, and choese to make a new one, we should save it as the filename we passed in.
    if args.token != 'new':
        filename = args.token

    with open(filepath, 'w') as f:
        json.dump(tokenData, f, sort_keys = True, indent = 4, ensure_ascii = False)
    print(f"Updated launcher token {filepath}")

# cmd args to send to hytale.exe    
args = {
    '--app-dir': config['app-dir'],
    #'--client_dir': config['client_dir'], # Idk about this one. the launcher uses it, but the game dosent need it?
    '--user-dir': config['user-dir'],
    '--java-exec': config['java-exec'],
    '--auth-mode': config['auth-mode'],
    '--uuid': token['uuid'],
    '--name': token['user'],
    '--identity-token': token['identity_token'],
    '--session-token': token['session_token'] 
}
# Construct the full path to the executable
executable = f"{args['--app-dir']}/Client/HytaleClient.exe"
if os.path.isfile(executable) == False:
    print(f'\nERROR: Hytale client Not found {executable}\nPlease check your config and try again.')
    exit()

# Build command-line arguments list
cmd_args = [executable]
for key, value in args.items():
    cmd_args.extend([key, value])

# Launch hytale with args
print(f"\nLaunching HyTale\n{executable}\nauth-mode: {args['--auth-mode']}\nusername: {args['--name']}\nuuid: {args['--uuid']}")
process = subprocess.Popen(
    cmd_args,
    creationflags=subprocess.CREATE_NEW_CONSOLE
)

# After launch, set HyTale to run multi threadded wiht as many cores as it can find.
kernel32 = ctypes.windll.kernel32
handle = int(process._handle)
kernel32.SetProcessAffinityMask(handle, 0xFF)

print(f"HyTale PID: {process.pid}")
