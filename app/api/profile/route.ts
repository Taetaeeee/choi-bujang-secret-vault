import {auth,saveProfile,profileSchema,failure,reply} from '@/lib/server';
export async function POST(r:Request){try{const owner=await auth(r,true);const p=profileSchema.parse(await r.json());await saveProfile(owner,p);return reply({saved:true,profile:p});}catch(e){return failure(e);}}
