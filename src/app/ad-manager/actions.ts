'use server';
import {requireSession} from '@/server/auth';
import {draftMetaOperation} from '@/server/meta-operations';
import {revalidatePath} from 'next/cache';
export type DraftState={error?:string;message?:string};
export async function createMetaDraft(_previous:DraftState,form:FormData):Promise<DraftState>{
 const session=await requireSession();try{await draftMetaOperation(session,form);revalidatePath('/ad-manager');return {message:'Draft saved. Review the account, snapshots and requested changes below. No Meta write was sent.'};}catch(e){return {error:e instanceof Error&&!('code' in e)?e.message:'Draft could not be saved. Check migrations, account access and inputs.'};}
}
