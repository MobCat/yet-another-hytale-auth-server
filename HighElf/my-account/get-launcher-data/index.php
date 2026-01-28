<?php 
//https://account-data.hytale.com/my-account/get-launcher-data
//https://account-data.hytale.com/my-account/get-launcher-data?arch=amd64&os=windows
//This api is mostly for the launcher, which im not fully emulating.
//But I am wrighting this script to help people know what the server does support.
//If you want to see what clients a HighElf server supports, just GET this api endpoint.

require_once "../../utils/generic.php";
require_once "../../utils/valadate.php";

//if no args are presented, then you just get patch vers for windows
//otherwise you can use ?os=linux, os=darwin or os=mac.

//if you use os=all this is a specal case that will not only show all supported oses, but all supported vers.

//if a valid Bearer token is presented, then you will reseve back valid provile info, otherwise its spoofed.

//?arch= is ignored as each os ver only has one one arch right now, so no point checking otherwise.

// Connect to SQLite database
$dbPath = "../../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Get client info if any
[$sessionID, $UserInfo] = valadateRequestHeadders($pdo);


//Set os type
//Not sure if darwin should = mac or the other way around...
$allowedOS = [
    'windows' => 'windows',
    'linux' => 'linux',
    'mac' => 'darwin',
    'darwin' => 'darwin',
    'macos' => 'darwin',
    'all' => 'all'
];

// Get and validate the OS parameter
if (isset($_GET['os'])) {
	$selectedOS = strtolower(trim($_GET['os'] ?? ''));
	if (!isset($allowedOS[$selectedOS])) {
		$selectedOS = 'windows';
	}
} else {
	$selectedOS = 'windows';
}

// Build out patchlines based on os selected.
if ($selectedOS == 'all') {
	// Template for patchlines. we are making some stuff up to support evreything here.
	// If that dosent work, either dont spesify all or spesify an os.
	$patchlines = [
		'pre-release' => [
			'windows' => [],
			'linux' => [],
			'darwin' => []
		],
		'release' => [
			'windows' => [],
			'linux' => [],
			'darwin' => []
		]
	];

	$stmt = $pdo->prepare("SELECT * FROM approvedClients WHERE patchLine = 'release' ORDER BY buildNumber DESC");
	$stmt->execute();
	$resultRelease = $stmt->fetchall(PDO::FETCH_ASSOC);
	foreach ($resultRelease as $result) {
		$patchlines['release'][$result['osName']][] = [
			'buildVersion' => explode('HytaleClient/', $result['client'])[1],
			'buildNumber' => $result['buildNumber']
		];
	}
	// I was gonna do this with one sql query, but the orders would all be off as release and pre-release get all mixed up
	$stmt = $pdo->prepare("SELECT * FROM approvedClients WHERE patchLine = 'pre-release' ORDER BY buildNumber DESC");
	$stmt->execute();
	$resultRelease = $stmt->fetchall(PDO::FETCH_ASSOC);
	foreach ($resultRelease as $result) {
		$patchlines['pre-release'][$result['osName']][] = [
			'buildVersion' => explode('HytaleClient/', $result['client'])[1],
			'buildNumber' => $result['buildNumber']
		];
	}

} else {
	$stmt = $pdo->prepare("SELECT * FROM approvedClients WHERE osName = ? AND patchLine = 'release' ORDER BY buildNumber DESC LIMIT 1");
	$stmt->execute([$selectedOS]);
	$resultRelease = $stmt->fetch(PDO::FETCH_ASSOC);

	$stmt = $pdo->prepare("SELECT * FROM approvedClients WHERE osName = ? AND patchLine = 'pre-release' ORDER BY buildNumber DESC LIMIT 1");
	$stmt->execute([$selectedOS]);
	$resultPrerelease = $stmt->fetch(PDO::FETCH_ASSOC);

	//I dont have any pre-release builds up for testing
	if ($resultPrerelease == null){
		$resultPrerelease['client'] = 'HytaleClient/';
		$resultPrerelease['buildNumber'] = null;
	}
	// You should always have something up, but ill make a check for both.
	if ($resultRelease == null){
		$resultRelease['client'] = 'HytaleClient/';
		$resultRelease['buildNumber'] = null;
	}

	$patchlines = [
		'pre-release' => [
			'buildVersion' => explode('HytaleClient/', $resultPrerelease['client'])[1], //Sure this is jank. but results are results.
			'newest' => $resultPrerelease['buildNumber']
		],
		'release' => [
			'buildVersion' => explode('HytaleClient/', $resultRelease['client'])[1],
			'newest' => $resultRelease['buildNumber']
		]
	];
}

// If valid session token, use that account info, otherwise genrate fake data.
if ($UserInfo){
	$username = $UserInfo['username'];
	$clientUUID = $UserInfo['uuid'];
	$clientEntitlements = $UserInfo['entitlements'];
	$clientTime = gmdate('Y-m-d\TH:i:s\Z', $UserInfo['profileInit']);
	$clientTimeOffset = gmdate('Y-m-d\TH:i:s\Z', $UserInfo['profileInit']+rand(8, 20));
} else {
	$username = "HighElf";
	$clientUUID = guidv4();
	$clientTime = gmdate('Y-m-d\TH:i:s\Z', time()-60);
	$clientTimeOffset = gmdate('Y-m-d\TH:i:s\Z', time()-06+rand(8, 20));
	$clientEntitlements = ["game.base"];
}

// Output data template
$results = [
	'eula_accepted_at' => $clientTimeOffset,
	'owner' => $clientUUID,
	'patchlines' => $patchlines,
	'profiles' => [[ //This would suggest that you can have more then one account? Spoofed to only one for now.
		"createdAt" => $clientTime,
		"entitlements" => $clientEntitlements,
		//"nextNameChangeAt" => "time", //idk what this is, and idk how to check if this is even needed or not.
		"username" => $username,
		"uuid" => $clientUUID
	]]
];

header('Content-Type: application/json');
echo json_encode($results);
?>