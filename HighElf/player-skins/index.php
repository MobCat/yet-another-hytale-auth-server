<?php
//https://account-data.hytale.com/player-skins
require_once "../utils/valadate.php";
require_once "../utils/get.php";
require_once "../utils/generic.php";

// Set headers to accept JSON
header('Content-Type: application/json');

// Connect to SQLite database
$dbPath = "../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Helper utils
[$sessionID, $UserInfo] = valadateRequestHeadders($pdo);
[$clientUUID, $clientUsername, $clientEntitlements, $sessionStart, $sessionEnd, $scope] = valadateAuthorization($pdo);
$serverConfig = getServerConfigs($pdo);
$activeSkin = getActiveSkin($pdo, $clientUUID, $serverConfig);

// Afaik only the client can edit or load your avatar from this api endpoint
// This check is probs stupid and not needed but ima do it anyway
if ($scope != 'hytaleclient') { //idk what happend to the : and I dont cear... bug for lator mobs.
	die(json_encode(['ERROR' => 'Unauthorized client']));
}


// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Handle GET request
if ($method === 'GET') {
	//Returns your list of skins. This list does appear to be in alphabetical order
	//It would be poseibal to return a difrent order but this fine for now.
	//Default for maxSkins is 5. 20 overflows of screen, 15 is fine as a new max.
	$result = [
		'activeSkin' => $activeSkin['skinId'],
		'maxSkins' => $serverConfig['maxSkins'],
		'skins' => []
	];
	// append all skins to skins array
	//TODO: if dbresult null, return default skin, which if null that should be the active skin from the get util
	//However it seems like the game does a PUT update to player-skins/active/ for this so needs more testing.
	//skinIds with old in them OLD-38ad3c5e-d75e-4045-b750-913951b6ac6e are from the older game clients
	//back when you could only have 1 avatar, not multible. HighElf has been updated to support both old and new client vers.
	$stmt = $pdo->prepare("SELECT * FROM avatars WHERE ownerId = ? AND skinId NOT LIKE 'OLD%'");
	$stmt->execute([$clientUUID]);
	$dbresult = $stmt->fetchAll(PDO::FETCH_ASSOC);
	if ($dbresult) {
		foreach ($dbresult as $skin) {
			$temp = [];
			$temp['id'] = $skin['skinId'];
			$temp['name'] = $skin['name'];
			//Remove them as we dont need them anymore.
			unset($skin['ownerId']);
			unset($skin['skinId']);
    		unset($skin['lastActive']);
    		//Fun pirate hat override because this is a cracked server
    		//This overide only works for loading, when saving the real hat will be saved
    		//And saveing / loading / isActive a a new avatar will not get forceHat.
    		//forceHat is only applyed on game load.
    		//However, only if you select a new hat, otherwise the pirate hat will be saved as your new hat.
    		if ($serverConfig['forceHat'] == 1){
    			$skin['headAccessory'] = 'Pirate_Captain_Hat.BrownDark';
    		}
    		//append the rest of the data
    		$temp['skinData'] = json_encode($skin);
			$result['skins'][] = $temp;
		}
	} else {
		// if no skins at all found. coopt getActiveSkin to give use a new default skin.
		$temp = [];
		$temp['id'] = $clientUUID;
		$temp['name'] = 'Default';

		$skin = getActiveSkin($pdo, $clientUUID, $serverConfig);
		unset($skin['ownerId']);
		unset($skin['skinId']);
    	unset($skin['lastActive']);
    	$temp['skinData'] = json_encode($skin);
    	$result['skins'][] = $temp;
	}
} elseif ($method === 'PUT') {
	//TODO: Handle error if PUT is not json.
	$postData = json_decode(file_get_contents('php://input'), true);
    if (isset($_GET['action']) && $_GET['action'] === 'active') {
        // Handle player-skins/active
        $time = time();
		$stmt = $pdo->prepare("UPDATE avatars SET lastActive = ? WHERE skinId = ? AND ownerId = ?");
		$stmt->execute([$time, $postData['skinId'], $clientUUID]);
		$result = ["success" => true, "action" => "lastActive", "time" => $time, "skinId" => $postData['skinId']];
        
    } elseif (isset($_GET['skinId'])) {
        // Handle player-skins/{uuid} to update or rename skin
        $skinId = $_GET['skinId'];
        $skinName = $postData['name'];
        $skinData = json_decode($postData['skinData'], true);
        $time = time();
        if($skinData) {
        	$skinData['ownerId'] = $clientUUID;
        	$skinData['skinId'] = $skinId;
        	$skinData['lastActive'] = time();
        	$skinData['name'] = $skinName;

        	// Build data query
        	$columns = array_keys($skinData);
        	$placeholders = array_map(fn($col) => ":$col", $columns);
        	// Create the INSERT with ON CONFLICT UPDATE (upsert)
        	$columnsList = implode(', ', $columns);
        	$placeholdersList = implode(', ', $placeholders);
        	// Build UPDATE
        	$updateColumns = array_filter($columns, fn($col) => $col !== 'skinId');
        	$updateList = implode(', ', array_map(fn($col) => "$col = :$col", $updateColumns));

			// Shove that shit into the db
			$sql = "INSERT INTO avatars ($columnsList) VALUES ($placeholdersList)
					ON CONFLICT(skinId) DO UPDATE SET $updateList";
			$stmt = $pdo->prepare($sql);
			$stmt->execute($skinData);

			$result = ["success" => true, "action" => "uuid", "time" => $time, "skinId" => $skinId, "name" => $skinName];

        } else {
        	$result = ["success" => false, "action" => "uuid", "time" => $time, "skinId" => $skinId, "name" => $skinName];
        }

        
    } else {
        die(json_encode(['PUT' => 'Unknown request']));
    }
} elseif ($method === 'POST') {
	// Insert a new charactor? idk if used for anything else yet.
	$postData = json_decode(file_get_contents('php://input'), true);
    $skinData = json_decode($postData['skinData'], true);
    if($skinData) {
		$skinData['ownerId'] = $clientUUID;
		$skinData['skinId'] = guidv4(); //TODO: we are not checking if uuid already in db. should be fine...
		$skinData['lastActive'] = time();
		$skinData['name'] = $postData['name'];

    	// Build data query
    	$columns = array_keys($skinData);
    	$placeholders = array_map(fn($col) => ":$col", $columns);
    	$columnsList = implode(', ', $columns);
    	$placeholdersList = implode(', ', $placeholders);
    	$updateColumns = array_filter($columns, fn($col) => $col !== 'skinId');
    	$updateList = implode(', ', array_map(fn($col) => "$col = :$col", $updateColumns));

		// Shove that shit into the db
		$sql = "INSERT INTO avatars ($columnsList) VALUES ($placeholdersList)
				ON CONFLICT(skinId) DO UPDATE SET $updateList";
		$stmt = $pdo->prepare($sql);
		$stmt->execute($skinData);

		//201 Created
		$result = ["skinId" => $skinData['skinId']];
	} else {
		$result = ["success" => false, "error" => "bad POST json"];
	}
} elseif ($method === 'DELETE') {
	// Detele an avatar by skin id
	//WARNING: this func is verey hacked togetner
	//We are relying on valadateAuthorization util and sql prepare A LOT
	//we should be doing other checks so random people cant delete your things
	//But problem for lator mobs.
	$skinId = $_GET['skinId'];

	$stmt = $pdo->prepare("DELETE FROM avatars WHERE ownerId = ? AND skinId = ?");
	$stmt->execute([$clientUUID, $skinId]);
	$dbresult = $stmt->fetchAll(PDO::FETCH_ASSOC);

	$result = ["skinId" => $skinId];
}

//output result
echo json_encode($result);