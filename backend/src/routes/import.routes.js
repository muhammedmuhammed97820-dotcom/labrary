const express = require("express");
const { authenticate, requireAdmin } = require("../middleware/auth.middleware");
const { scanAndImport } = require("../services/smart-library-agent-v6.service");

const router = express.Router();
let job={running:false,startedAt:null,finishedAt:null,error:"",url:"",stage:"idle",pages:0,discovered:0,normalized:0,imported:0,result:null};
router.get("/smart/status",authenticate,requireAdmin,(req,res)=>res.json(job));
router.post("/smart/scan",authenticate,requireAdmin,async(req,res)=>{
 if(job.running)return res.status(409).json({message:"يوجد استيراد ذكي يعمل حالياً.",job});
 const url=String(req.body?.url||"").trim();
 if(!/^https?:\/\//i.test(url))return res.status(400).json({message:"أدخل رابط مكتبة صحيحاً يبدأ بـ http أو https."});
 const maxPages=Math.min(Math.max(Number.parseInt(req.body?.maxPages,10)||100,1),300);
 const importNow=req.body?.importNow!==false,downloadFiles=req.body?.downloadFiles===true,updateExisting=req.body?.updateExisting===true;
 job={running:true,startedAt:new Date().toISOString(),finishedAt:null,error:"",url,stage:"crawling",pages:0,discovered:0,normalized:0,imported:0,result:null};
 res.status(202).json({message:"بدأ الوكيل الذكي V6 بتحليل الكتب والمؤلفين والتصنيفات والصور الخارجية.",job});
 try{const result=await scanAndImport(url,{maxPages,import:importNow,downloadFiles,updateExisting});job.running=false;job.finishedAt=new Date().toISOString();job.stage="completed";job.pages=result.pages;job.discovered=result.discovered;job.normalized=result.normalized;job.imported=result.imported;job.result=result;}
 catch(error){job.running=false;job.finishedAt=new Date().toISOString();job.stage="failed";job.error=error?.message||"فشل الاستيراد الذكي.";}
});
module.exports=router;
