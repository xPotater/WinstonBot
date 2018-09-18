const cfg = require("./config.json");

const Discord = require("discord.js");
const client = new Discord.Client();

const NaturalLanguageUnderstandingV1 = 
    require("watson-developer-cloud/natural-language-understanding/v1");

const PersonalityInsightsV3 =
    require("watson-developer-cloud/personality-insights/v3");

const nlu = new NaturalLanguageUnderstandingV1({
    version: "2018-03-16",
    iam_apikey: cfg.nlu_key,
    url: "https://gateway-wdc.watsonplatform.net/natural-language-understanding/api"
});

const pi = new PersonalityInsightsV3({
    version: "2017-10-13",
    iam_apikey: cfg.pi_key,
    url: "https://gateway-wdc.watsonplatform.net/personality-insights/api"
});

function nluAnalyze(params, msg)
{
    nlu.analyze(params, function(err, res) {
        if(err)
            console.log("error:", err);

        else
            var textResult = JSON.stringify(res, null, 4);
            textResult = splitStr(textResult, 1992);
            textResult.forEach(element => {
                msg.channel.send("```\n" + element + "\n```");
            });
    });
}

function piProfile(params, msg)
{
    pi.profile(params, function(err, res) {
        if(err)
            console.log("error:", err);

        else
        {
            var textResult;
            res.personality.forEach(trait => {
                textResult += trait.name + ": " + (Math.round(trait.percentile*10000) / 100) + " percentile \n";
                trait.children.forEach(facet => {
                    textResult += "   " + facet.name + ": " + (Math.round(facet.percentile*10000) / 100) + " percentile \n";
                });
            });

            textResult += "Needs\n";
            res.needs.forEach(need => {
                textResult += "   " + need.name + ": " + (Math.round(need.percentile*10000) / 100) + " percentile \n";
            });

            textResult += "Values\n";
            res.values.forEach(value => {
                textResult += "   " + value.name + ": " + (Math.round(value.percentile*10000) / 100) + " percentile \n";
            });

            res.consumption_preferences.forEach(category => {
                textResult += category.name + "\n";
                category.consumption_preferences.forEach(preference => {
                    textResult += "   " + preference.score + " " + preference.name + ": ";
                    if(preference.score === 0) textResult += "UNLIKELY\n";
                    if(preference.score === 0.5) textResult += "NEUTRAL\n";
                    if(preference.score === 1) textResult += "LIKELY\n";
                });
            });

            textResult = splitStr(textResult, 1992);
            textResult[0] = textResult[0].substring(9);
            textResult.forEach(x => {
                msg.channel.send("```\n" + x + "\n```");
            });
        }
    });
}

function splitStr(str, limit)
{
    if(typeof limit === "undefined") limit = 2000;
    else limit = parseInt(limit);
    
    str = str.split("\n");
    var result = [];
    var tempData = "";

    str.forEach(x => {
        
        if(x.length + tempData.length < limit)
        {
            tempData += x + "\n";
        }
        else
        {
            result.push(tempData);
            tempData = x + "\n";
        }
    })

    if(tempData !== "") result.push(tempData);

    return result;
}


client.login(cfg.token);

client.on("ready", () => {
    console.log("Bot is online!");
});

client.on("message", async(msg) => {
    if(msg.author.bot) return;

    if(msg.content.startsWith(cfg.prefix + "nlu "))
    {
        var text = msg.content;
        text = text.split(" ");
        text.shift();
        text = text.join(" ");

        var params = {
            text: text,
            features: {
                concepts:{
                    limit: 4
                },
                categories: {},
                emotion: {},
                entities:{
                    emotion: true,
                    sentiment: true,
                    limit: 12
                },
                keywords:{
                    emotion: true,
                    sentiment: true,
                    limit: 12
                },
                relations:{},
                sentiment:{}
            },
            language: "en",
            clean: "false"
        }

        nluAnalyze(params, msg);
    }

    if(msg.content === (cfg.prefix + "pi"))
    {
        var text;
        var params;
        var filter = m => m.author.id === msg.author.id;
        var collector = msg.channel.createMessageCollector(filter, {
            max: 15,
            time: 60000
        });

        msg.channel.send("Paste your text. You may send up to 15 messages. " +
            "Put \"--end\" at the end of the last message.")

        collector.on("collect", (m) => {
            text += m.content;
            msg.channel.send("Accepted.");
            if(text.includes("--end")) collector.stop();
        });

        collector.on("end", () => {
            msg.channel.send("Message collection ended.")
            params = {
                content: text,
                content_type: "text/plain",
                consumption_preferences: true
            }

            piProfile(params, msg);
        });
    }
});