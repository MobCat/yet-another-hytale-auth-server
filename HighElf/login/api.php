<?php
//Login page for HighElf server emulator
//This page has no relation to HyTale. however if a /login endpoint is found and conflicts with the game we can move this.

$input = file_get_contents('php://input');
$data = json_decode($input, true);
#print_r($input);

//TODO: 
if ($data == null){
	header('Location: index.php');
	die();
}

//TODO: We curently do not have an error for auth token server not found or not running.

header('Content-type: application/json');
// We probs should sanatize / force to string here, but fine for now I guess. Just overthinking.
$uuid = $data['uuid'] ?? '';
$email = $data['email'] ?? '';
$user = $data['user'] ?? '';
$password = $data['password'] ?? '';
$otp = $data['otp'] ?? '';
$launcherToken = $data['token'] ?? '';

// You must enter something to login with
if (empty($email) || empty($password)) {
	if (empty($launcherToken)) {
    	http_response_code(400);
    	die(json_encode(['error' => 'email and password required']));
    }
}

// Load Helpers
require_once "../utils/valadate.php";
require_once "../utils/get.php";
require_once "../utils/client.php";

// Connect to SQLite database
$dbPath = "../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$serverConfig = getServerConfigs($pdo);
$clientInfo = IPChunk();

if (!empty($email)) {
	// New login
	$stmt = $pdo->prepare("SELECT * FROM accounts WHERE email = :email LIMIT 1");
	$stmt->bindParam(':email', $email, PDO::PARAM_STR);
	$stmt->execute();
	$result = $stmt->fetch(PDO::FETCH_ASSOC);

	// Valadate password
	if ($result) {
		if (password_verify($password, $result['password'])) {
			//PLACEHOLDER TODO: actualy setup otp checks
			if ($result['otpToken'] != null and $otp == '') { 
				http_response_code(401);
				die(json_encode(['error' => 'This account needs an opt code to login']));
			}

			// Login successful

			// Update client hash to db
			$stmt = $pdo->prepare("UPDATE accounts SET ipHash = :ipHash WHERE uuid = :uuid");
			$stmt->bindParam(':ipHash', $clientInfo['clientToken'], PDO::PARAM_STR);
			$stmt->bindParam(':uuid', $result['uuid'], PDO::PARAM_STR);
			$stmt->execute();

			#echo $resp['success'];

		} else {
			// Invalid password
			http_response_code(401);
			die(json_encode(['error' => 'Invalid login, Your email or password may be incorect']));
		}
	} else {
		// Email not found
		http_response_code(401);
		die(json_encode(['error' => 'Invalid credentials']));
	}
} elseif (!empty($launcherToken) and !empty($uuid) and !empty($user)) {
	// Excisting login, valadate old token
	$stmt = $pdo->prepare("SELECT * FROM accounts WHERE launcherToken = :launcherToken AND uuid = :uuid AND username = :username LIMIT 1");
	$stmt->bindParam(':launcherToken', $launcherToken, PDO::PARAM_STR);
	$stmt->bindParam(':uuid', $uuid, PDO::PARAM_STR);
	$stmt->bindParam(':username', $user, PDO::PARAM_STR);
	$stmt->execute();
	$result = $stmt->fetch(PDO::FETCH_ASSOC);

	//TODO: user can only stayLoggedIn if there ip hash is the same, otherewise make them login.
	//TODO: If users stayLoggedIn and otpToken then ask for otp always.

	if ($result) {
		// Check if user is re-logging back in from the same device
		if ($result['ipHash'] !== $clientInfo['clientToken']){
			die(json_encode(['error' => 'Token Invalid, please re-login']));
		}
		//PLACEHOLDER: check if token expired
		//Might want to make tokens last longer then generic timeout config
		$userSettings = json_decode($result['settings'], true); 
		if (($result['sessionInit'] + $serverConfig['sessionTimeout']) < time() && !$userSettings['stayLoggedIn']) {
			// This *should* be safe as you *should* only get here if you have entered a valid login, but it has expired.
			// Keep an eye on this though as it could be possible to leak user emails if you leak a token then
			// try and use said token from the authorized users device
			die(json_encode(['error' => 'Session expired, please re-login', 'email' => $result['email']]));
		}
	} else {
		die(json_encode(['error' => 'Invalid token']));
	}

	//print_r($result);
} else {
	die(json_encode(['error' => 'Invalid input data', 'input' => $input]));
}



// ok now we are done with valadating the user, send back there data
// Send request to exturnal auth server to get tokens genraited.
// Define the URL and data
$url = $serverConfig['authProvider'].'/session';
#die(json_encode(['debug' => true, 'url' => $url]));
//TODO: we are not checking who sent this login request, we are just assuming its the client
$data = ['uuid' => $result['uuid'], 'name' => $result['username'], 'scope' => 'hytale:client'];
// Initialize cURL session
$curl = curl_init();
curl_setopt($curl, CURLOPT_URL, $url);
curl_setopt($curl, CURLOPT_POST, true);
curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
$headers = array(
   "Accept: application/json",
   "Content-Type: application/json",
);
curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
$data = json_encode($data);
curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
$resp = curl_exec($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);
$response_data = json_decode($resp, true);

if ($response_data === null) {
   	die('Error decoding JSON response');
}

// if we have data from tokens server
if (isset($response_data['success']) && $response_data['success']) {
	//print_r($response_data);
	//TODO: Check if $response_data['expires_in'] is valid? right now though it just gives a exps in 8000 sec, not expires in unix time stamp
	//TODO: Check if $result['sessionID'] is not null. if it is, then assume the user is still logged in.
	//echo $response_data['session_id'];
	//echo $response_data['identity_token'];
	//echo $response_data['session_token'];

	//Make new temp token for launcher auto login
	$launcherToken = bin2hex(random_bytes(64));

	// use token data in db
	//$stmt = $pdo->prepare("INSERT INTO accounts (sessionID, sessionInit) VALUES (:sessionID, :sessionInit)");
	$timeMeow = time();
	$stmt = $pdo->prepare("UPDATE accounts SET sessionID = :sessionID, sessionInit = :sessionInit, launcherToken = :launcherToken WHERE uuid = :uuid");
	$stmt->bindParam(':sessionID', $response_data['session_id'], PDO::PARAM_STR);
	$stmt->bindParam(':sessionInit', $timeMeow, PDO::PARAM_INT);
	$stmt->bindParam(':launcherToken', $launcherToken, PDO::PARAM_STR);
	$stmt->bindParam(':uuid', $result['uuid'], PDO::PARAM_STR);
	$stmt->execute();

	if ($result['otpToken']) { $otp = True; } else { $otp = False; }

	if ($stmt->rowCount() > 0) {
		echo(json_encode([
			'success'=>true, 
			'session_id'=>$response_data['session_id'], 
			'identity_token'=>$response_data['identity_token'],
			'session_token'=>$response_data['session_token'],
			'launcher_token'=>$launcherToken,
			'user'=>$result['username'],
			'uuid'=> $result['uuid'],
			'entitlements' => $result['entitlements'],
			'otp' => $otp,
			'ext'=>time()+$serverConfig['sessionTimeout']
		]));
	} else {
		http_response_code(401);
		die(json_encode(['error' => 'Database error']));
	}
} else {
	http_response_code(401);
	die(json_encode(['error' => 'Token server on smoko']));
}

?>