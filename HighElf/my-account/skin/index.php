<?php
//https://account-data.hytale.com/my-account/skin
//Please note: This api endpoint is beeing depcraited.
//this api endpoint is for release builds 8 and below
//and pre-release builds 17 and below
//I have done by best to make all vers compatible with the same server but its a bit jank.
//This system only handles saving of avatars for older vers of the game
//The new system handles loading but kinda jank. it just loads the "isActive" skin.
require_once "../../utils/valadate.php";

// Set headers to accept JSON
header('Content-Type: application/json');

// Connect to SQLite database
$dbPath = "../../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Valadate client, get session id and account data.
$clientVer = valadateClient($pdo);
[$sessionID, $UserInfo] = valadateRequestHeadders($pdo);

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Get all request headers using PHP's built-in function
$headers = getallheaders();

// Handle PUT request
if ($method === 'PUT') {
    // Get the raw PUT data
    $putData = file_get_contents('php://input');
    
    $jsonData = json_decode($putData, true);
    //print_r($jsonData);
    if ($jsonData) {
        //print_r($jsonData);
        //TODO: Valdate incomming data is real cometics for this client ver

        //Save valadated data to db
        $jsonData['ownerId'] = $UserInfo['uuid'];
        $jsonData['skinId'] = 'OLD-'.$UserInfo['uuid'];
        $jsonData['isActive'] = null;
        $jsonData['name'] = 'OLD-Default';
        // Build column names and placeholders
        $columns = array_keys($jsonData);
        $placeholders = array_map(fn($col) => ":$col", $columns);
        // Create the INSERT with ON CONFLICT UPDATE (upsert)
        $columnsList = implode(', ', $columns);
        $placeholdersList = implode(', ', $placeholders);
        // Build UPDATE clause (all columns except uuid)
        $updateColumns = array_filter($columns, fn($col) => !in_array($col, ['ownerId', 'skinId']));
        $updateList = implode(', ', array_map(fn($col) => "$col = :$col", $updateColumns));

        #print_r($jsonData);

        // Try to update first where both ownerId and skinId match
        $updateSql = "UPDATE avatars SET $updateList WHERE ownerId = :ownerId AND skinId = :skinId";
        $stmt = $pdo->prepare($updateSql);
        $stmt->execute($jsonData);

        // If no rows were updated, insert a new one
        if ($stmt->rowCount() === 0) {
            $insertSql = "INSERT INTO avatars ($columnsList) VALUES ($placeholdersList)";
            $stmt = $pdo->prepare($insertSql);
            $stmt->execute($jsonData);
        }
        //We have to brake this into 2 as we cant INSERT AND WHERE at the same time.

    } else {
        die("Invalid JSON or non-JSON data");
    }
    
    // Send response
    echo json_encode([
        'success' => true,
    ]);
}


// Handle other methods
else {
    http_response_code(201);
}
?>