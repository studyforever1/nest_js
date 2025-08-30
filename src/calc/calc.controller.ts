// calc.controller.ts
import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import axios from 'axios';

@Controller('sj')
export class CalcController {

  @Post('start')
  async start(@Body() body: any) {
    const res = await axios.post('http://localhost:8000/sj_start', body);
    return res.data;
  }

  @Post('stop')
  async stop(@Body() body: { task_id: string }) {
    const res = await axios.post('http://localhost:8000/sj_stop', body);
    return res.data;
  }

  @Get('get_progress')
  async getProgress(@Query('task_id') task_id: string) {
    const res = await axios.get(`http://localhost:8000/sj_get_progress/?task_id=${task_id}`);
    return res.data;
  }
}
