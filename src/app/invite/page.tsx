import {getSession} from '@/server/auth';
import AcceptInvitation from '@/components/accept-invitation';
export const dynamic='force-dynamic';
export default async function InvitePage(){const session=await getSession();return <AcceptInvitation signedIn={!!session}/>;}
