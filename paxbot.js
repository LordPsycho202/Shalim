//Includes
const Discord = require("discord.js");
const client = new Discord.Client();
const log4js = require('log4js');
const fs = require("fs");
const http = require('http');
const https = require('https');
const GoogleMapsAPI = require('googlemaps');
const Random = require("random-js");

//Import Configurations
const config = require("./config.json");
const command = require("./messages.json");
const weatherjson = require("./weather.json");

//Configure and setup Google API Connection
var gapiConfig = {
			key: config.googleapiToken,
			stagger_time: 1000,
			secure: true
		};
var gmAPI = new GoogleMapsAPI(gapiConfig);


//Configure Logging
log4js.configure(
  {
    appenders: { paxbot: {type: 'file', filename: 'pax.log' } },
    categories: { default: { appenders: ['paxbot'], level: config.loglevel } }
  }
);
const logger = log4js.getLogger('paxbot');

//declared functions

//Function to return Random integer
//Takes two integer numbers as input, representing the low and high values of the range
function randomInt (low, high) {
  var r = new Random(Random.engines.mt19937().autoSeed());
  return r.integer(low,high);
  //return Math.round(Math.random() * (high - low) + low);
}

//Function to input log entry under INFO tier
//Takes string input
function loginfo(message) {
  console.log("[INFO] " + message);
  logger.info(message);
}

//Function to input log entry under Error tier
//Takes string input
function logerror(message) {
	console.error("[ERROR] " + message);
	logger.error(message);
}

//Function to input log entry under DEBUG tier
//Takes string input
function logdebug(message) {
	logger.debug(message);
	if (config.loglevel=="debug") {
		console.error(message);
	}
}

//Function to test if object is declared and initialized
function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}


//Log into Discord and Prepare to function
client.login(config.discordToken);

client.on("ready", () => {
  loginfo("I am ready!");
});


//Main message handling method
client.on("message", (message) => {


	// Exit and stop if the prefix is not there or if user is a bot
	if (!message.content.startsWith(config.prefix) || message.author.bot) return;


  //Return Help Message upon command prefix+'help'
	if (message.content.startsWith(config.prefix + "help")) {

		//Test to see if User is an Admin.
		let is_admin = message.member.hasPermission("ADMINISTRATOR");
		//IF user is Admin, give one greeting, otherwise give other.
		if (!is_admin) {
			var output = "Thank you mortal for imploring my help.\nThese are the commands you have access to.\n\n";
		} else {
			var output = "You request was recieved, most gracious " + message.author.username + "\nThese are the commands you have access to.\n\n";
		}

		//Format string for commands usable by all
		output = output + config.prefix + "ping : See how fast I am responding.\n";
		output = output + config.prefix + "random : Something Random happens.  If you follow it with something, that random thing will happen to what that is, otherwise it happens to you!\n" ;
		output = output + config.prefix + "weather : Gives you your weather if you put your city after it.  City must be listed either as <city>,<country> or <city>,<state>\n";
		output = output + config.prefix + "curse : Makes something bad happen to your target.  Target must be specified to work.\n"
		output = output + config.prefix + "setting : Gives you a random setting to start with.\n"

		//Format Additional string for commands usable only by Admins.
    if (is_admin) {

			output = output + "\nThese Commands must be sent to me via Direct Message\n";
			output = output + "Admin Commands\n";
			output = output + config.prefix + "cmd list <list> : Prints out a full list of command <list>\n";
			output = output + config.prefix + "cmd add <list> \"<entry>\" : adds <entry> to <list>.  You can use %USER% to replace with user/target, and %CHANNEL% to replace with channel name.\n";
			output = output + config.prefix + "cmd remove <list> <entry#> : removes the specified number from the list.  See " + config.prefix + "admin list <list> to get entry numbers.\n";
	        }

		//Output formatted string and enter log entry
		message.channel.send(output);
		loginfo("[CMD] "+message.author.username+" has requested help");
		return;
	}


  //Command for testing if Bot is up and responding quickly
	if (message.content.startsWith(config.prefix + "ping")) {
		//Send Reply
		message.channel.send("pong!");

		//Enter Log Entry
		loginfo("[CMD] "+message.author.username + " used ping");
		logdebug("[REPLY] pong!");
		return;
  	}

  //Admin Command to change Prefix. Will Probably moe later
	if(message.content.startsWith(config.prefix + "prefix")) {
		//Test for Admin Privilege
		let is_admin = message.member.hasPermission("ADMINISTRATOR");
		//Send Error message if user is not admin, exit message return
		if (!is_admin) {
			message.channel.send("I cannot allow you to do that, "+message.author.username);
			logerror("[CMD] "+message.author.username+" tried to change the prefix");
			logdebug("[REPLY] I cannot allow you to do that, "+message.author.username);
			return;
		}

		// Gets the prefix from the command (eg. "!prefix +" it will take the "+" from it)
		let newPrefix = message.content.split(" ").slice(1, 2)[0];
		// change the configuration in memory
		config.prefix = newPrefix;
		// Now we have to save the file.
		fs.writeFile("./config.json", JSON.stringify(config), (err) => console.error);
		//Send Acknowledgement and enter Log Entry
		message.channel.send(message.author.username + " has requested the prefix be changed to " + newPrefix + ", and so shall it be.");
		loginfo("[CMD] "+message.author.username + " changed prefix to " + newPrefix);
		logdebug("[REPLY] "+message.author.username + " has requested the prefix be changed to " + newPrefix + ", and so shall it be.");
		return;
  }

	//Get current weather at specified place and return it to chat.  Originally used as proof of concept for Weather API
	if(message.content.startsWith(config.prefix + "weather")) {
		//Split message string at first space
		let param = message.content.replace(/\ /,'&').split("&");
		//If there are no parameters to the command, Error out, else do API Call
		if (param.length == 1) {
			//Format output message and return it
      var output = "I need to know where to get the weather for.\n";
			output = output + config.prefix + "weather : Gives you your weather if you put your city after it.  City must be listed either as <city>,<country> or <city>,<state>";
			message.channel.send(output);
			//Enter Log entries
			logerror("[CMD] "+message.author.username+" tried to use "+config.prefix+"weather without a location");
			logdebug("[REPLY] "+output);
			return;
		} else {
      //Set Loc equal to parameter from command, remove all remaining spaces
			loc = param[1]
			loc = loc.replace(/\s/g,'');
		  //prepare and configure API call
			var response = '';
			var options = {
                		host: 'api.openweathermap.org',
		                port: 80,
        		        path: '/data/2.5/weather?q='+loc+'&APPID='+config.openweatherToken,
                		method: 'POST'
		        };
			//Do http request to Weather API.  Need to fix this so I can use weather API data outside of call, but I suck currently at asyncronous programming...
        		http.request(options, function(res) {
	                	res.setEncoding('utf8');
        	                res.on('data', function (chunk) {
														//parse response into JSON
                		        response = JSON.parse(chunk);
														//Error out if 404 - meaning location was not found.  More than likely caused by tomfoolery from Pax group.
					if (response.cod=="404") {
						//Log Error message
						logerror("[API] Weather Recieved. Code: "+response.cod);
						//Prepare random weather event for chat error message
						var weather = weatherjson.random.split("||");
						var num = randomInt(0,(weather.length-1));
						output = "It is currently "+randomInt(-100,1000)+"°C in "+message.author.username+", :cooking: with raining "+weather[num];
						//send message reply
						message.channel.send(output);
						//Additional Logging
						logerror("[CMD] "+message.author.username+" tried to find the weather for "+loc);
						logdebug("[REPLY] "+output);
					} else {
						//Log Successfull API Call
						loginfo("[API] Weather Recieved. Code: "+response.cod);
						//Parse information from response JSON
						var weather = response.weather[0];
						var system = response.sys;
						ctemp = Math.round(response.main.temp - 273.15);
						wicon = weatherjson.icon[weather.icon];
						//Format return string
						output = "It is currently " + ctemp + "°C in " + response.name + ", :flag_"+system.country.toLowerCase()+": with " + weather.description + " " + wicon;
						//Send results to channel
						message.channel.send(output);
						//Final Logging of API Call and channel output
						loginfo("[CMD] "+message.author.username+" has requested the weather for "+response.name);
						logdebug("[REPLY] "+output);
					}
		                });
	        	}).end();

		}
		return;
        }

	if(message.content.startsWith(config.prefix + "setting")) {

		var setting_array = command.setting.split("||");
		var array_len = setting_array.length-1;
		var settingnum = randomInt(0,array_len);
		var provis_setting = setting_array[settingnum].split("|");
		var loc = provis_setting[0];
		var output = provis_setting[1];


		var response = '';
		var options = {
			host: 'api.openweathermap.org',
			port: 80,
			path: '/data/2.5/weather?q='+loc+'&APPID='+config.openweatherToken,
			method: 'POST'
		};

		http.request(options, function(res) {
			res.setEncoding('utf8');
			res.on('data', function (chunk) {
				wresponse = JSON.parse(chunk);
				if (wresponse.cod=="404") {
					message.channel.send("ERROR: You should probably post this in the paxbot-fixes channel for DP\n"+response);
					logerror("[API] Weather failed for location "+loc+" Code: "+wresponse.cod);
					logdebug("[API] Full response: "+wresponse);
				} else {
					loginfo("[API] Weather Recieved. Code: "+wresponse.cod);
					logdebug("[API] Location: "+wresponse.name+", "+wresponse.sys.country);
					var weather = wresponse.weather[0];
					var system = wresponse.sys;
					var text_temp;
					var text_time;
					ctemp = Math.round(wresponse.main.temp - 273.15);
					if (ctemp <= 0) {
						text_temp = "freezing";
					} else if (ctemp > 0 && ctemp <= 7) {
						text_temp = "cold";
					} else if (ctemp > 7 && ctemp <= 17) {
						text_temp = "cool";
					} else if (ctemp > 17 && ctemp <= 27) {
						text_temp = "warm";
					} else if (ctemp > 27 && ctemp <= 37) {
						text_temp = "hot";
					} else {
						text_temp = "hot as hell";
					}

					gmAPI.timezone(
						{
							location: wresponse.coord.lat+','+wresponse.coord.lon,
							timestamp: wresponse.dt,
						},
						function(err,result){
							if (!err) {
								loginfo("[API] Timezone recieved. Status: "+result.status);
								logdebug("[API] Timezone ID: "+result.timeZoneId);
								logdebug("[API] Timezone Name: "+result.timeZoneName);
								var offset = result.dstOffset+result.rawOffset;
							} else {
								logerror("[API] Timezone Error. Status: "+result.status);
								logdebug("[API] gchunk: "+result.json);
								var offset = 0;
							}

							unix_time = wresponse.dt;
							var date = new Date((unix_time+offset)*1000);
							var hours = date.getHours();

							if (hours >= 0 && hours < 2) {
								text_time = "midnight";
							} else if (hours >= 2 && hours < 6) {
								text_time = "early morning";
							} else if (hours >= 6 && hours < 12) {
								text_time = "morning";
							} else if (hours >= 12 && hours < 17) {
								text_time = "afternoon";
							} else if (hours >= 17 && hours < 20) {
								text_time = "evening";
							} else if (hours >= 20 && hours < 22) {
								text_time = "night";
							} else {
								text_time = "midnight";
							}

							output = output.replace(/%TIME%/gi,text_time);
							output = output.replace(/%TEMP%/gi,text_temp);
							if (config.insanity=="true") {
								var ranweather_array = weatherjson.random.split("||");
								var num = randomInt(0,(ranweather_array.length-1));
								weather.description = ranweather_array[num];
							}
							output = output.replace(/%WEATHER%/gi,weather.description);

							message.channel.send(output);

							loginfo("[CMD] "+message.author.username+" has requested a setting.");
							logdebug("[REPLY] "+output);
						}
					);
				}
			})
		}).end();
		return;
	}



	if(message.content.startsWith(config.prefix + "random")) {
		var target = message.content.replace(/\ /,'&').split("&");

		if (target.length == 1) {
			var targ = message.author.username;
		} else {
			var targ = target[1];
		}

		var action = command.random.split("||");
		var len = action.length-1
		var actionnum = randomInt(0,len);
		var output = action[actionnum];

		output = output.replace(/%USER%/gi,targ);
		output = output.replace(/%CHANNEL%/gi,"#"+message.channel.name);

		message.channel.send(output);

		loginfo("[CMD] "+message.author.username + " ran random with target "+targ);
		logdebug("[REPLY] " + output);
		return;
	}

        if(message.content.startsWith(config.prefix + "curse")) {
                var target = message.content.replace(/\ /,'&').split("&");

                if (target.length == 1) {
                        output="You must specify a Target to use a curse on";
			message.channel.send(output);
			logerror("[CMD] "+message.author.username+" tried to use a curse without a target")
			return;
                } else {
                        var targ = target[1];
                }

		var user=message.author.username;
                var action = command.curse.split("||");
                var len = action.length-1
                var actionnum = randomInt(0,len);
                var output = action[actionnum];

                output = output.replace(/%TARG%/gi,targ);
		output = output.replace(/%USER%/gi,user);
                output = output.replace(/%CHANNEL%/gi,"#"+message.channel.name);

                message.channel.send(output);

                loginfo("[CMD] "+message.author.username + " ran curse with target "+targ);
                logdebug("[REPLY] " + output);
                return;
        }

	if(message.content.startsWith(config.prefix + "cmd")) {

		let is_admin = message.member.hasPermission("ADMINISTRATOR");
                if (!is_admin) {
                        output = "I cannot allow you to do that, "+message.author.username;
			message.channel.send(output);
                        logerror("[CMD] "+message.author.username+" tried to access "+config.prefix+"cmd");
			logdebug("[REPLY] "+output);

                        return;
                }

		var subcommand = message.content.split(" ")[1];

		if (subcommand == "list") {

			var item = message.content.split(" ")[2];
			var components = command[item];
			var list = components.split("||");

			var len = list.length;

			var output = config.prefix + item + " has a total of " + len + " Options:\n";

			for (i=0;i<len;i++)
			{
				j = i + 1;
				output = output + "[" + j + "]: " + list[i] + "\n";
				if ( (j%10) == 0 && j != len ) {
						message.channel.send(output);
						output = '';
				}
			}

			message.channel.send(output);
			loginfo("[CMD] "+message.author.username+" has requested the "+item+" list");
			logdebug("[REPLY] "+output);
			return;
		}

		if (subcommand == "add") {
			var item = message.content.split(" ")[2];
			var newlist = command[item];
			newlist = newlist + "||" + message.content.split("\"")[1]
			//message.author.send(newlist);
			command[item] = newlist;
			fs.writeFile("./messages.json", JSON.stringify(command), (err) => console.error);
			output = "Item '" + message.content.split("\"")[1] + "' has been added to list " + config.prefix + item + "."
			message.channel.send(output);
	                loginfo("[CMD] "+message.author.username + " added an item to list: " + config.prefix + item);
			logdebug("[REPLY] "+output);
			return;
		}

		if (subcommand == "remove") {
			var item = message.content.split(" ")[2];
			var rem = message.content.split(" ")[3];
			var components = command[item];
			var list = components.split("||");

			var len = list.length;

			var output = "";
			for (i=0;i<len;i++)
			{
				if(!(i==rem-1)) {
					output = output + list[i] + "||";
				}
			}

			output = output.slice(0,-2);
			//message.author.send(output);
			command[item] = output;
			fs.writeFile("./messages.json", JSON.stringify(command), (err) => console.error);
			output = "Item [" + rem + "]: '" + list[rem-1] + "' has been removed.";
			message.channel.send(output);
			loginfo("[CMD] "+message.author.username + " removed ["+rem+"]: '" + list[rem-1] + "' from" + config.prefix + item);
			logdebug("[REPLY "+output);
			return;
		}

		if (subcommand == "insanity") {
			var task = message.content.split(" ")[2];

			if (task == "on") {
				config.insanity="true";
				output = message.author.username + " has just activated insanity mode...hope you have your steel umbrellas handy...";
				message.channel.send(output);
				loginfo("[CMD] "+message.author.username+" has just activated insanity mode for settings");
				logdebug("[REPLY] "+output);
			} else if (task == "off") {
				config.insanity="false";
				output = message.author.username + " has just deactivated insanity mode...you can put away the steel umbrellans.";
                                message.channel.send(output);
                                loginfo("[CMD] "+message.author.username+" has just deactivated insanity mode for settings");
                                logdebug("[REPLY] "+output);
			} else if (task == "status") {
				if (config.insanity=="true") {
					mode = "on";
				} else {
					mode = "off";
				}
				output = "The Insanity mode is currently "+mode;
				message.channel.send(output);
				loginfo("[CMD] "+message.author.username+" wanted to know the Insanity Mode. It's "+mode+" in case you wanted to know...");
                                logdebug("[REPLY] "+output);
				return;


			} else {
				output = "You are either insane or you are not - never aim to do things in halves.";
				message.channel.send(output);
				loginfo("[CMD] "+message.author.username+" really messed up trying to change the insanity mode...");
				logdebug("[REPLY] "+output);
				return;
			}

			fs.writeFile("./config.json", JSON.stringify(config), (err) => console.error);
			return;
		}



	}


});

client.on("guildMemberAdd", (member) => {
  loginfo(`New User "${member.user.username}" has joined "${member.guild.name}"` );
  var welcome = command.welcome;
  member.guild.defaultChannel.send(welcome.replace(/%USER%/gi,member.user.username));
  loginfo("[NEW MEMBER] "+member.user.username+"has been welcomed.");
  logdebug("[REPLY] "+welcome.replace(/%USER%/gi,member.user.username));
});
