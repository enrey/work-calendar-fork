import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserEntity } from '../../entity/entities/user.entity';
import { UserDto } from '../dto/user.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel('Users') private readonly userModel: Model<UserEntity>) {}

  async getUsers(): Promise<UserEntity[]> {
    return await this.userModel
      .find()
      .populate('jobPosition')
      .populate('subdivision')
      .populate('skills')
      .sort({ username: 'asc' })
      .exec();
  }

  async getUsersLocation(): Promise<string[]> {
    return await this.userModel
      .find({ $or: [{ terminationDate: { $gte: new Date().toISOString() } }, { terminationDate: null }] })
      .distinct('location')
      .exec();
  }

  async getUserByLogin(mailNickname: string): Promise<UserEntity> {
    const employeeRegex = new RegExp(`^${mailNickname}$`, 'i');
    return await this.userModel
      .findOne({ mailNickname: employeeRegex })
      .populate('jobPosition')
      .populate('subdivision')
      .populate('skills')
      .exec();
  }

  async getUserById(id: string): Promise<UserEntity> {
    return await this.userModel.findById(id).populate('jobPosition').populate('subdivision').populate('skills').exec();
  }

  async addUser(userInfo: UserDto): Promise<UserEntity> {
    const newUser = await this.userModel.create(userInfo);
    return newUser.save();
  }

  async updateUserByLogin(login: string, data: UserDto): Promise<UserEntity> {
    await this.userModel.updateOne({ mailNickname: login }, { ...data });
    return await this.getUserByLogin(login);
  }
}
