const Discord = require('discord.js');
const config = require('./config/config.json');
const Enmap = require('enmap');

const client = new Discord.Client({
    allowedMentions: {
        parse: ["users", "roles"],
        repliedUser: true,
    },
    partials: ["MESSAGE", "CHANNEL"],
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
    ]
});

client.db = new Enmap({
    name: "db",
    dataDir: "./db"
});

client.tickets = new Enmap({
    name: "tickets",
    dataDir: "./tickets"
});

client.login(config.token);

//MENSAJE DE ENCENDIDO
client.on("ready", () => {
    console.log(`Conectado como ${client.user.tag}`)
})

//Comprobar bases de datos
//console.log(client.db.get("883421044235468850"))


//COMANDOS
client.on("messageCreate", async (message) => {
    if(!message.guild || message.author.bot) return;

    const args = message.content.slice(config.prefix.length).trim().split(" ");
    const cmd = args.shift()?.toLowerCase();

    if(!message.content.startsWith(config.prefix) || !cmd || cmd.length == 0) return;

    client.db.ensure(message.guild.id, {
        channel: "",
        message: "",
        category: "",
    });

    if(cmd == "ping"){
        return message.reply(`El ping del bot es \`${client.ws.ping}ms\``)
    }

    if(cmd == "setup"){
        let channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
        if(!channel) return message.reply("❌ No he encontrado el canal que has mencionado!");

        const msg = await channel.send({
            embeds: [new Discord.MessageEmbed()
            .setTitle(`📥 Create a Ticket`)
            .setDescription(`To create a ticket, just click the button that says \`📥 create a ticket\``)
            .setColor("BLUE")
            .setTimestamp()
            ],
            components: [new Discord.MessageActionRow().addComponents([new Discord.MessageButton().setStyle("SUCCESS").setLabel("Create a ticket").setEmoji("📥").setCustomId("crearticket")])]
        });

        client.db.set(message.guild.id, channel.id, "channel");
        client.db.set(message.guild.id, channel.parentId, "category");
        client.db.set(message.guild.id, msg.id, "message");

        return message.reply(`✅ Ticket system successfully configured in the channel ${channel}`);
    }
});

client.on("interactionCreate", async (interaction) => {
    if(!interaction.isButton() || !interaction.guildId || interaction.message.author.id != client.user.id) return;

    client.db.ensure(interaction.guild.id, {
        channel: "",
        message: "",
        category: "",
    });

    const data = client.db.get(interaction.guild.id);

    if(interaction.channelId == data.channel && interaction.message.id == data.message){
        switch (interaction.customId) {
            case "createticket": {
                if(client.tickets.has(interaction.member.user.id)){
                    let ticket = interaction.guild.channels.cache.get(client.tickets.get(interaction.member.user.id, "channelid"));
                    if(ticket && client.tickets.get(interaction.member.user.id, "closed") == false) return interaction.reply({content: `❌ Ya tienes un ticket creado en <#${ticket.id}>`, ephemeral: true})
                }

                await interaction.reply({content: "Creating your ticket... please wait", ephemeral: true});
                const channel = await interaction.guild.channels.create(`ticket-${interaction.member.user.username}`, {
                    type: "GUILD_TEXT",
                    parent: data.category,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: ["VIEW_CHANNEL"]
                        },
                        {
                            id: interaction.member.user.id,
                            allow: ["VIEW_CHANNEL"]
                        }
                    ]
                });

                channel.send({embeds: [
                    new Discord.MessageEmbed()
                    .setTitle(`Ticket of ${interaction.member.user.tag}`)
                    .setDescription(`Welcome to support ${interaction.member}\nExplain your problem in detail`)
                    .setColor("BLUE")
                    .setTimestamp()
                ],
                components: [new Discord.MessageActionRow().addComponents([new Discord.MessageButton().setStyle("DANGER").setLabel("CLOSE").setEmoji("🔒").setCustomId("cerrarticket"),
                new Discord.MessageButton().setStyle("SECONDARY").setLabel("BORRAR").setEmoji("🗑").setCustomId("borrarticket")])]
            });

            client.tickets.set(interaction.member.user.id, {
                channelid: channel.id,
                closed: false
            });

            return await interaction.editReply({content: `✅ Ticket created in ${channel}!`})
            }
                break;
        
            default:
                break;
        }
    }

    if(client.tickets.has(client.tickets.findKey(t => t.channelid == interaction.channelId))) {
        switch (interaction.customId) {
            case "cerrarticket": {
                const key = client.tickets.findKey(t => t.channelid == interaction.channelId);
                if(key) {
                    const ticket = client.tickets.get(key);
                    if(ticket.closed == true) return interaction.reply({content:"❌ This ticket was already closed!", ephemeral: true});
                    const msg = await interaction.reply("The ticket will auto-close in 3 seconds...")
                    setTimeout(async () => {
                        await interaction.editReply({content: "TICKET CLOSED 🔐"})
                        client.tickets.set(key, true, "closed");
                        return interaction.channel.permissionOverwrites.edit(key, {VIEW_CHANNEL: false});
                    }, 3 * 1000);
                }
            }
                
                break;

                case "borrarticket": {
                    await interaction.reply("The ticket will be deleted in 3 seconds...");
                    setTimeout(() => {
                        interaction.channel.delete();
                    }, 3 * 1000);
                }
                break;
            default:
                break;
        }
    }
})