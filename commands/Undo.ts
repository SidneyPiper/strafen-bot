import {ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder} from 'discord.js';
import Command from '../core/Command';
import {LOGO_URL} from '../core/Helpers';
import getDatabase from '../database/data-source';
import {Equal} from 'typeorm';
import {Infraction} from '../database/entity/Infraction';

export default new Command('undo')
    .setBuilder(builder => builder.setDescription('Undo your most recent blame.'))
    .setHandler(async interaction => {
        await interaction.deferReply({ephemeral: true});

        const database = await getDatabase();

        const blamee = interaction.user;

        await database.getRepository(Infraction).findOneOrFail({
            where: {
                guild_id: Equal(interaction.guild.id),
                user_id: Equal(blamee.id)
            },
            order: {
                created_on: 'DESC'
            },
            relations: {
                penalty: true
            }
        }).then(async (infraction: Infraction) => {
            const blamed = await interaction.guild.members.fetch(infraction.user_id);

            const confirmationEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`Are you sure you want to undo you blaming ${blamed.displayName} for ${infraction.penalty.name}?`)
                .setAuthor({name: interaction.guild.name + ' Strafenbot', iconURL: LOGO_URL})

            const confirm = new ButtonBuilder()
                .setCustomId('confirm')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success);

            const cancel = new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(confirm, cancel);

            const confirmationMessage = await interaction.editReply({
                content: blamee.toString(),
                embeds: [confirmationEmbed],
                components: [row],
            });

            const collectorFilterConfirmation = i => {
                return i.user.id === blamee.id;
            };

            try {
                // Wait for the user to confirm the undo
                const confirmation = await confirmationMessage.awaitMessageComponent({
                    filter: collectorFilterConfirmation,
                    time: 60_000
                });

                if (confirmation.customId === 'cancel') {
                    const confirmationCancelEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(`You decided not to undo the blame!`)
                        .setAuthor({name: interaction.guild.name + ' Strafenbot', iconURL: LOGO_URL});

                    await confirmationMessage.edit({
                        content: null,
                        embeds: [confirmationCancelEmbed],
                        components: []
                    });

                    return;
                } else if (confirmation.customId === 'confirm') {
                    const confirmationSuccessEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle(`You undid the blame! Really nice of you ${blamed.displayName}!`)
                        .setAuthor({name: interaction.guild.name + ' Strafenbot', iconURL: LOGO_URL});

                    database.getRepository(Infraction).remove(infraction)
                        .then(async () => {
                            await confirmationMessage.edit({
                                content: null,
                                embeds: [confirmationSuccessEmbed],
                                components: []
                            });
                        }).catch(async () => {
                        await interaction.reply({
                            content: `:warning: Something went wrong while trying to undo the blame.`,
                            ephemeral: true
                        });
                    });

                    return;
                }
            } catch (e) {
                const notInTimeEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`You didn't confirm in time, the undo was canceled!`)
                    .setAuthor({name: interaction.guild.name + ' Strafenbot', iconURL: LOGO_URL})

                await confirmationMessage.edit({
                    content: null,
                    embeds: [notInTimeEmbed],
                    components: []
                })

                return;
            }
        }).catch(() => {
            interaction.editReply({
                content: `:warning: Nothing to undo for you.`,
            });
        });
    });
