import express from 'express';
import multer from 'multer';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Resend } from 'resend';

const router = express.Router();
router.use(cors({origin:['https://lurk-app.com','https://www.lurk-app.com']}));
const upload = multer({limits:{files:3,fileSize:5242880,fields:18,fieldSize:4000}});
router.post('/requests',rateLimit({windowMs:900000,max:12}),upload.array('photos',3),async(req,res)=>{
  const data=req.body;
  if (!data.name?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||'') || data.consent!=='on') return res.sendStatus(400);
  const attachments=[];
  for (const file of req.files||[]) {
    const b=file.buffer;
    const ext=b.subarray(0,3).equals(Buffer.from([255,216,255]))?'jpg':b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'?'webp':null;
    if(!ext) return res.sendStatus(400);
    attachments.push({filename:'reference-'+(attachments.length+1)+'.'+ext,content:b});
  }
  if (!process.env.RESEND_API_KEY) return res.sendStatus(503);
  try {
    const fields=['name','email','type','wood','length','width','height','style','budget','deadline','notes'];
    const result=await new Resend(process.env.RESEND_API_KEY).emails.send({
      from:process.env.WOODWORKING_EMAIL_FROM || 'Lurk Woodworking <workshop@lurk-app.com>',
      to:'support@lurk-app.com',replyTo:data.email,subject:'Woodworking project request',
      text:fields.map(k=>k+': '+String(data[k]||'')).join('\n'),attachments
    });
    if(result.error || !result.data?.id) return res.sendStatus(503);
    res.status(202).json({sent:true});
  } catch {res.sendStatus(503);}
});
router.get('/checkout/:id',(req,res)=>{
  const links={1:process.env.STRIPE_BOWL_LINK,2:process.env.STRIPE_CUP_LINK,3:process.env.STRIPE_STICK_LINK};
  try {
    const url=new URL(links[req.params.id]);
    if(url.origin==='https://buy.stripe.com' && !url.pathname.startsWith('/test_')) return res.json({url:url.href});
  } catch {}
  res.sendStatus(404);
});
router.use((err,req,res,next)=>res.sendStatus(err instanceof multer.MulterError?400:500));
export default router;
