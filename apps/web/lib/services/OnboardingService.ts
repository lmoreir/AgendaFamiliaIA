import { prisma } from "../prisma";
import { redis, RedisKeys, REDIS_TTL } from "../redis";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agenda-familia-ia-web.vercel.app";

type NoAccountStage = "awaiting_email";
type NoFamilyStage = "awaiting_family_name";

function isEmailLike(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

/**
 * Fluxo de onboarding para usuários SEM CONTA.
 * Tenta localizar conta pelo e-mail e vincular o telefone automaticamente.
 * Retorna a mensagem a ser enviada ao usuário.
 */
export async function handleNoAccount(phone: string, text: string): Promise<string> {
  const stageKey = RedisKeys.onboardingStage(phone);
  const stage = (await redis.get(stageKey)) as NoAccountStage | null;

  const normalized = text.trim().toLowerCase();

  // Saudações reiniciam o fluxo
  const isGreeting = /^(oi|olá|ola|oi!|hey|hello|bom dia|boa tarde|boa noite|inicio|iniciar|comecar|começar)$/i.test(normalized);

  if (!stage || isGreeting) {
    await redis.setex(stageKey, REDIS_TTL.onboarding, "awaiting_email");
    return (
      `Olá! 👋 Sou o assistente do *Agenda Família IA*.\n\n` +
      `Parece que você ainda não tem uma conta vinculada a este número.\n\n` +
      `Me informe seu *e-mail de cadastro* e eu vinculo este número à sua conta automaticamente:`
    );
  }

  if (stage === "awaiting_email") {
    if (!isEmailLike(text)) {
      return (
        `Hmm, isso não parece um e-mail válido. 🤔\n\n` +
        `Me informe seu e-mail de cadastro (ex: *maria@email.com*):`
      );
    }

    const email = text.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Vincula o telefone e limpa o estado de onboarding
      await prisma.user.update({
        where: { id: user.id },
        data: { phone_whatsapp: phone },
      });
      await redis.del(stageKey);

      console.log(`[Onboarding] Telefone ${phone} vinculado ao usuário ${user.email}`);
      return (
        `✅ Encontrei sua conta!\n\n` +
        `Número vinculado ao perfil de *${user.name || user.email}*. ` +
        `Agora você pode usar o assistente normalmente.\n\n` +
        `Experimente:\n` +
        `• _"o que tem essa semana?"_\n` +
        `• _"cadastra natação da Ana amanhã às 17h"_\n` +
        `• _"quais são meus filhos?"_`
      );
    }

    // E-mail não encontrado
    return (
      `Não encontrei nenhuma conta com o e-mail *${email}*. 😕\n\n` +
      `Crie sua conta gratuita em:\n${APP_URL}/cadastro\n\n` +
      `Depois de criar, volte aqui e me informe seu e-mail novamente que faço a vinculação! 🔗`
    );
  }

  // Estado desconhecido — reinicia
  await redis.del(stageKey);
  return handleNoAccount(phone, "oi");
}

/**
 * Fluxo de onboarding para usuários COM CONTA mas SEM FAMÍLIA.
 * Guia o usuário a criar a família pelo WhatsApp.
 * Retorna { response, familyId? } — familyId presente quando família foi criada.
 */
export async function handleNoFamily(
  userId: string,
  phone: string,
  text: string
): Promise<{ response: string; familyId?: string }> {
  const stageKey = RedisKeys.onboardingStage(`family:${userId}`);
  const stage = (await redis.get(stageKey)) as NoFamilyStage | null;

  if (!stage) {
    await redis.setex(stageKey, REDIS_TTL.onboarding, "awaiting_family_name");
    return {
      response:
        `Sua conta ainda não tem uma família cadastrada. 👨‍👩‍👧‍👦\n\n` +
        `Qual é o nome da sua família?\n_(Ex: Família Silva, Casa dos Moreiras)_`,
    };
  }

  if (stage === "awaiting_family_name") {
    const familyName = text.trim();

    if (familyName.length < 2 || familyName.length > 80) {
      return {
        response: `Por favor, informe um nome para a família (entre 2 e 80 caracteres):`,
      };
    }

    const family = await prisma.family.create({
      data: {
        owner_id: userId,
        name: familyName,
        timezone: "America/Sao_Paulo",
      },
    });

    await redis.del(stageKey);

    console.log(`[Onboarding] Família "${familyName}" criada para usuário ${userId}`);
    return {
      familyId: family.id,
      response:
        `✅ Família *${family.name}* criada com sucesso!\n\n` +
        `Agora você pode:\n` +
        `• _"adiciona João nos meus filhos"_\n` +
        `• _"cadastra natação da Ana amanhã às 17h"_\n` +
        `• _"o que tem essa semana?"_\n\n` +
        `Como posso ajudar? 😊`,
    };
  }

  await redis.del(stageKey);
  return handleNoFamily(userId, phone, text);
}
