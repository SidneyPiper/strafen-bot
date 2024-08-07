import {AttachmentBuilder, EmbedBuilder} from 'discord.js';
import {LOGO_URL} from '../core/Helpers';
import getDatabase from '../database/data-source';
import {Penalty} from '../database/entity/Penalty';
import Command from '../core/Command';
import genImageOfList from "../views/List";

export default new Command('list')
    .setBuilder(builder => builder.setDescription('Shows available penalties.'))
    .setHandler(async interaction => {
        await interaction.deferReply()

        const database = await getDatabase();

        const penalties = await database
            .getRepository(Penalty)
            .createQueryBuilder('penalty')
            .select('penalty.name', 'name')
            .addSelect('penalty.description', 'description')
            .addSelect('penalty.price', 'price')
            .where('penalty.guild_id = :guild_id', {guild_id: interaction.guild.id})
            .getRawMany()

        const imageBuffer = await genImageOfList(penalties)

        const attachment = new AttachmentBuilder(imageBuffer, {name: "penalties.png"})

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Penalties List')
            .setAuthor({name: interaction.guild.name + ' Strafenbot', iconURL: LOGO_URL})
            .setDescription('All available penalties. Click the image below to enlarge.')
            .setImage('attachment://penalties.png')

        await interaction.editReply({embeds: [embed], files: [attachment]});
    });
