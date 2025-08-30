import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CalcService {
  private readonly baseUrl = 'http://192.168.3.4:8000';

  // 启动计算
  async startCalculation(data: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/sj_start/`, data);
      return response.data; // 返回 task_id 等信息
    } catch (err) {
      console.error('计算启动失败', err.response?.data || err.message);
      throw err;
    }
  }

  // 查询进度
  async getProgress(taskId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/sj_get_progress/${taskId}`);
      return response.data;
    } catch (err) {
      console.error('查询进度失败', err.response?.data || err.message);
      throw err;
    }
  }

  // 停止计算
  async stopCalculation(taskId: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/sj_stop/`, { task_id: taskId });
      return response.data;
    } catch (err) {
      console.error('停止计算失败', err.response?.data || err.message);
      throw err;
    }
  }
}
