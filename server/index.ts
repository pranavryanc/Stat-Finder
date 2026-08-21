import express from 'express'
import { pool } from './db.js'
import { nbaBoxScore, nbaMetadata, nbaNearestCalendarDay, nbaQualityReport, searchNba } from './nbaRepository.js'
import { searchNbaAggregate } from './nbaAggregateRepository.js'
import { nflBoxScore, nflMetadata, nflNearestCalendarDay, nflQualityReport, searchNfl } from './nflRepository.js'
import { searchNflAggregate } from './nflAggregateRepository.js'

const app=express()
const port=Number(process.env.PORT??8787)
const allowedOrigin=process.env.ALLOWED_ORIGIN?.trim()

app.use((req,res,next)=>{
  if(allowedOrigin){
    res.setHeader('Access-Control-Allow-Origin',allowedOrigin)
    res.setHeader('Vary','Origin')
    res.setHeader('Access-Control-Allow-Headers','Content-Type')
    res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  }
  if(req.method==='OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json({limit:'1mb'}))

app.get('/api/health',async(_req,res)=>{
  try{
    const result=await pool.query('SELECT now() AS database_time')
    res.json({ok:true,database:'connected',databaseTime:result.rows[0]?.database_time??null})
  }catch(error){
    console.error(error)
    res.status(503).json({ok:false,database:'unavailable'})
  }
})
app.get('/api/nba/meta',async(_req,res)=>{try{res.json(await nbaMetadata())}catch(e){console.error(e);res.status(500).json({error:'NBA database is not ready. Run the schema and ingestion steps.'})}})
app.get('/api/nba/qa',async(_req,res)=>{try{res.json(await nbaQualityReport())}catch(e){console.error(e);res.status(500).json({error:'NBA quality report failed.'})}})
app.post('/api/nba/search',async(req,res)=>{try{res.json(await searchNba(req.body))}catch(e){console.error(e);res.status(500).json({error:'NBA search failed.'})}})
app.post('/api/nba/aggregate-search',async(req,res)=>{try{res.json(await searchNbaAggregate(req.body))}catch(e){console.error(e);res.status(500).json({error:e instanceof Error?e.message:'NBA aggregate search failed.'})}})
app.get('/api/nba/calendar-day',async(req,res)=>{try{const month=Number(req.query.month);const day=Number(req.query.day);res.json(await nbaNearestCalendarDay(month,day))}catch(e){console.error(e);res.status(400).json({error:'Calendar-day lookup failed.'})}})
app.get('/api/nba/games/:gameId',async(req,res)=>{try{const game=await nbaBoxScore(req.params.gameId);if(!game)return res.status(404).json({error:'Game not found'});res.json(game)}catch(e){console.error(e);res.status(500).json({error:'Box score lookup failed.'})}})

app.get('/api/nfl/meta',async(_req,res)=>{try{res.json(await nflMetadata())}catch(e){console.error(e);res.status(500).json({error:'NFL database is not ready. Run db/003_nfl.sql and the NFL ingestion script.'})}})
app.get('/api/nfl/qa',async(_req,res)=>{try{res.json(await nflQualityReport())}catch(e){console.error(e);res.status(500).json({error:'NFL quality report failed.'})}})
app.get('/api/nfl/calendar-day',async(req,res)=>{try{const month=Number(req.query.month);const day=Number(req.query.day);res.json(await nflNearestCalendarDay(month,day))}catch(e){console.error(e);res.status(400).json({error:'NFL calendar-day lookup failed.'})}})
app.post('/api/nfl/search',async(req,res)=>{try{res.json(await searchNfl(req.body))}catch(e){console.error(e);res.status(500).json({error:e instanceof Error?e.message:'NFL search failed.'})}})
app.post('/api/nfl/aggregate-search',async(req,res)=>{try{res.json(await searchNflAggregate(req.body))}catch(e){console.error(e);res.status(500).json({error:e instanceof Error?e.message:'NFL aggregate search failed.'})}})
app.get('/api/nfl/games/:gameId',async(req,res)=>{try{const game=await nflBoxScore(req.params.gameId);if(!game)return res.status(404).json({error:'Game not found'});res.json(game)}catch(e){console.error(e);res.status(500).json({error:'NFL box score lookup failed.'})}})

app.listen(port,()=>console.log(`Stat Finder API running at http://localhost:${port}`))
