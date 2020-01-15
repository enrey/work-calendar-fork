import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaskEntity } from '../../entity/entities/task.request.model';
import { TaskResponseModel } from '../models/task.request.model';

@Injectable()
export class TaskService {
  constructor(@InjectModel('Tasks') private readonly taskModel: Model<TaskEntity>) {}

  async getTasks(): Promise<TaskResponseModel[]> {
    return await this.taskModel.find().exec();
  }

  async getTasksByAuthor(author: string): Promise<TaskResponseModel[]> {
    return await this.taskModel.find({ employeeCreated: author }).exec();
  }

  async addTask(task: TaskResponseModel): Promise<TaskResponseModel> {
    const newTask = await this.taskModel.create(task);
    return newTask.save();
  }
}
