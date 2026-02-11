<!DOCTYPE HTML>  
<html>
<head>
<style>
.error {color: #FF0000;}
</style>
</head>
<body>

<?php
//Stupid basic new account page
//Will change lator, I just need *something* to genrate new data so I dont have to do it by hand

function guidv4($data = null) {
    // Generate 16 bytes (128 bits) of random data or use the data passed into the function.
    $data = $data ?? random_bytes(16);
    assert(strlen($data) == 16);

    // Set version to 0100
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    // Set bits 6-7 to 10
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);

    // Output the 36 character UUID.
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}


// Connect to SQLite database
$dbPath = "../auth.db";
$pdo = new PDO("sqlite:$dbPath");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$keyCount = $pdo->query("SELECT COUNT(*) FROM betaKeys")->fetchColumn();

// define variables and set to empty values
$nameErr = $emailErr = $passwordErr = $keyErr = "";
$name = $email = $password = $key = "";

if ($_SERVER["REQUEST_METHOD"] == "POST") {
	//stupid shit
	if ($keyCount <= 0) {die();}

	//check if beta key is corect
	$key = $_POST['key'];
	$stmt = $pdo->prepare("SELECT key FROM betaKeys WHERE key = ?");
	$stmt->bindParam(1, $key, PDO::PARAM_STR);
	$stmt->execute();
	$result = $stmt->fetch(PDO::FETCH_ASSOC);
	if (!$result) {
		die("Invalid beta key");
	}

	//"valdate" user input
	if (empty($_POST["name"])) {
		$nameErr = "Username is required";
	} else {
		$name = test_input($_POST["name"]);
		// check if name only contains letters
		if (!preg_match("/^[a-zA-Z]*$/",$name)) {
			$nameErr = "Only letters allowed";
		}
	}
  if (empty($_POST["email"])) {
    $emailErr = "Email is required";
  } else {
    $email = test_input($_POST["email"]);
    // check if e-mail address is well-formed
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
      $emailErr = "Invalid email format";
    }
  }
  if (empty($_POST["password"])) {
  	$passwordErr = "Password is required";
  } else {
  	$password = test_input($_POST["password"]);
  }
  if (empty($_POST["key"])) {
  	$keyErr = "Beta key is required";
  } else {
  	$key = test_input($_POST["key"]);
  }

  	//Now we passed all the tests.. I guess... enter that shit into the db
	$timeMeow = time();
	$uuid = guidv4();
	$entitlements = '["game.base"]'; // This should be a config, and its valdateded else where, but this is okie too...
	$password = password_hash(hash('sha256', $password), PASSWORD_DEFAULT);
	$stmt = $pdo->prepare("INSERT INTO accounts (uuid, profileInit, username, email, password, entitlements) 
		                   VALUES (:uuid, :profileInit, :username, :email, :password, :entitlements)");
	$stmt->bindParam(':uuid', $uuid, PDO::PARAM_STR);
	$stmt->bindParam(':profileInit', $timeMeow, PDO::PARAM_INT);
	$stmt->bindParam(':username', $name, PDO::PARAM_STR);
	$stmt->bindParam(':email', $email, PDO::PARAM_STR);
	$stmt->bindParam(':password', $password, PDO::PARAM_STR);
	$stmt->bindParam(':entitlements', $entitlements, PDO::PARAM_STR);
	$stmt->execute();

	if ($stmt->rowCount() > 0) {
		echo("New account genrated. You can now login with it");
		// Delete used beta key
		$stmt = $pdo->prepare("DELETE FROM betaKeys WHERE key = ?");
		$stmt->execute([$key]);
		die();
	} else {
		http_response_code(401);
		die(json_encode(['error' => 'Database error']));
	}
}

function test_input($data) {
  $data = trim($data);
  $data = stripslashes($data);
  $data = htmlspecialchars($data);
  return $data;
}


?>
<h2>HighElf - New account</h2>
<h3>This services is in closed bata</h3>
There are <?=$keyCount?> beta keys left
<?php
	if ($keyCount <= 0) {
		echo("<br>Sorry, no beta keys left. Please try again lator");
		die();
	}
?>
<p><span class="error">* required field</span></p>
<i>HighElf will never email you or use this data, its just for login details</i>
<form method="post" action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]);?>">  
  Username: <input type="text" name="name" value="">
  <span class="error">* <?php echo $nameErr;?></span>
  <br>
  E-mail: <input type="text" name="email" value="">
  <span class="error">* <?php echo $emailErr;?></span>
  <br>
  Password: <input type="password" name="password" value="">
  <span class="error">* <?php echo $passwordErr;?></span><br>
  Beta Key: <input type="text" name="key" value="">
  <span class="error">* <?php echo $keyErr;?></span><br><br>
  <input type="submit" name="submit" value="Submit">  
</form>