import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
providers: [
GoogleProvider({
clientId: process.env.GOOGLE_CLIENT_ID!,
clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
}),
],
secret: process.env.NEXTAUTH_SECRET,
pages: {
signIn: "/login", // Din inloggningssida
},
callbacks: {
async redirect({ baseUrl }) {
// ✅ Skicka användaren till rätt dashboard
return `${baseUrl}/login/dashboard`;
},
},
});

export { handler as GET, handler as POST };