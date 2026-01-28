<?php
//https://account-data.hytale.com/my-account/game-profile
require_once "../../utils/valadate.php";
require_once "../../utils/config.php";

// Connect to SQLite database
$dbPath = "../../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Valadate client, get session id and account data.
// Othwise do all our utlis script things up here first
$clientVer = valadateClient($pdo);
[$sessionID, $UserInfo] = valadateRequestHeadders($pdo);
[$clientUUID, $clientUsername, $clientEntitlements, $sessionStart, $sessionEnd] = valadateAuthorization($pdo);
$serverConfig = getServerConfigs($pdo);

// Set headers to accept JSON
header('Content-Type: application/json');

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Get all request headers using PHP's built-in function
$headers = getallheaders();

// Handle GET request
if ($method === 'GET') {
    // Get skin / avatar data for player
    $stmt = $pdo->prepare("SELECT * FROM avatars WHERE uuid = ? LIMIT 1");
	$stmt->execute([$clientUUID]);
	$result = $stmt->fetch(PDO::FETCH_ASSOC);
	if ($result == null){
        //ASSume that we dont have any avatar data set yet, genrate some new stuff
        //Rely on avatar save to fix this data for use when user makes a new avater client side
        $result = [
            'uuid' => $clientUUID,
            'bodyCharacteristic' => 'Default.15',
            'underwear' => 'Suit.Blue',
            'face' => 'Face_Make_Up_2',
            'ears' => 'Default',
            'mouth' => 'Mouth_Default',
            'haircut' => 'FeatheredHair.BrownSemiLight',
            'facialHair' => null,
            'eyebrows' => 'Thin.BrownSemiLight',
            'eyes' => 'Medium_Eyes.Green',
            'pants' => 'Frilly_Skirt.Black',
            'overpants' => null,
            'undertop' => 'RibbedLongShirt.Orange',
            'overtop' => 'Tartan.Red',
            'shoes' => 'Trainers.Grey',
            'headAccessory' => 'Pirate_Captain_Hat.BrownDark',
            'faceAccessory' => null,
            'earAccessory' => 'DoubleEarrings.Gold_Red.Right',
            'skinFeature' => null,
            'gloves' => null,
            'cape' => null
        ];
    }
    //Remove user UUID from skin result as its not needed here, its added lator.
	unset($result['uuid']);

    //TODO: I feel like we should valdate any data was loaded, let alone the cornect data
    //but probs over thinking it, we put the data in the database, so it SHOULD be good to read it.

    //Fun: if serverConfig['forceHat'] == true
    //Forces $result['headAccessory'] = Pirate_Captain_Hat.BrownDark
    //The user can change and reset there hat, but apon load again, they will get a new hat again
    //Because this is a cracked server, so you gets a pirate hat. its just the rules.
    if ($serverConfig['forceHat'] == 1){
        $result['headAccessory'] = 'Pirate_Captain_Hat.BrownDark';
    }

    // Send response
    echo json_encode([
        'createdAt' => $sessionStart,
        'entitlements' => json_decode($clientEntitlements),
        'nextNameChangeAt' => $sessionEnd,
        'skin' => json_encode($result),
        'username' => $clientUsername,
        'uuid' => $clientUUID
    ]);

    die();
} else {
    echo json_encode(['Warning' => 'Unknown Action']);
}

?>