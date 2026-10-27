import {z} from 'zod';
import {auth,setBookmark,applicationSchema,failure,reply} from '@/lib/server';
const schema=z.object({id:applicationSchema.shape.id,bookmarked:z.boolean()});
export async function POST(r:Request){try{const owner=await auth(r,true);const {id,bookmarked}=schema.parse(await r.json());return reply(await setBookmark(owner,id,bookmarked));}catch(e){return failure(e);}}
