import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FollowEntity, FollowType } from '../../entity/entities/follow.entity.model';
import { FollowerModel } from '../models/follow.model';
import * as moment from 'moment';
import { UserEntity } from '../../entity/entities/user.entity.model';
import { UsersService } from './users.service';

export interface UserFollow {
  following: UserEntity[];
  followers: UserEntity[];
  allForUser: FollowEntity[];
}

@Injectable()
export class FollowService {
  constructor(@InjectModel('Follow') private readonly followModel: Model<FollowEntity>,
              private userService: UsersService) {
  }

  async getUserFollow(userId: string): Promise<UserFollow> {
    const following = await this.getMyFollowing(userId);
    const followers = await this.getMyFollowers(userId);
    const allForUser = await this.getAll(userId);

    return {
      following,
      followers,
      allForUser
    };
  }

  async getAll(userId: string): Promise<FollowEntity[]> {
    return await this.followModel
      .find({ $or: [{ followerId: userId }, { followingId: userId }] })
      .populate('followingId')
      .populate('followerId')
      .exec();
  }

  async getMyFollowing(currentUserId: string): Promise<UserEntity[]> {

    const allUsers = await this.userService.getUsers();
    const currentUser = await this.userService.getUserById(currentUserId);

    let followingByProjects = this.matchUsersAndActiveProjects(currentUser, allUsers);

    /** Если у пользователя нет проектов, то он подписан на всех */
    if (!currentUser.projects.length) {
      followingByProjects = allUsers;
    }

    const addedFollowing = await this.followModel
      .find({ followerId: currentUser.id, followType: FollowType.add });

    const removedFollowing = await this.followModel
      .find({ followerId: currentUser.id, followType: FollowType.remove });

    const addedUsers = addedFollowing.map(item => item.followingId).map(u => u.toString());
    const removedUsers = removedFollowing.map(item => item.followingId).map(u => u.toString());

    let result = this.addUserToArr(addedUsers, followingByProjects, allUsers);

    result = this.removeUsersFromArr(removedUsers, result);
    result = this.removeMyselfFromArr(currentUser.id, result);

    return result;
  }

  async addFollow(data: FollowerModel): Promise<FollowEntity> {
    const newFollow = await this.followModel.create(data);
    return newFollow.save();
  }

  async deleteFollow(id: string): Promise<FollowEntity> {
    return this.followModel.findByIdAndDelete(id);
  }

  async getMyFollowers(currentUserId: string): Promise<UserEntity[]> {

    const allUsers = await this.userService.getUsers();
    const currentUser = await this.userService.getUserById(currentUserId);
    const followersByProjects = this.matchUsersAndActiveProjects(currentUser, allUsers);

    const addedFollowersArr = await this.followModel
      .find({ followingId: currentUser.id, followType: FollowType.add });

    const removedFollowersArr = await this.followModel
      .find({ followingId: currentUser.id, followType: FollowType.remove });

    const addedUsers = addedFollowersArr.map(item => item.followerId).map(u => u.toString());
    const removedUsers = removedFollowersArr.map(item => item.followerId).map(u => u.toString());

    let result = this.addUserToArr(addedUsers, followersByProjects, allUsers);

    result = this.removeUsersFromArr(removedUsers, result);
    result = this.removeMyselfFromArr(currentUser.id, result);

    return result;
  }

  // Добавление пользователя в массив
  // проверяем, если он уже там есть, вернем массив
  // если его там нет, добавим
  private addUserToArr(addedUsers: string[], mainArr: UserEntity[], allUsers: UserEntity[]): UserEntity[] {

    if (!addedUsers.length) {
      return mainArr;
    }

    const usersAbsentInMainArr = addedUsers
      .filter(element => !mainArr.some((elem) => element === elem.id));

    if (!usersAbsentInMainArr.length) {
      return mainArr;
    }

    const userArr = usersAbsentInMainArr.map(item => {
      return allUsers.find(el => el.id === item);
    });

    return [...mainArr, ...userArr];
  }

  private removeUsersFromArr(removedUsers: string[], mainArr: UserEntity[]): UserEntity[] {
    if (!removedUsers.length) {
      return mainArr;
    }

    return mainArr.filter(user => !removedUsers.includes(user.id));
  }

  private removeMyselfFromArr(userId: string, arr: UserEntity[]) {
    return arr.filter(el => el.id !== userId.toString());
  }

  private matchUsersAndActiveProjects(selectedUser: UserEntity, allUsers: UserEntity[]): UserEntity[] {
    const selectedUserActiveProjects = this.getActiveUserProjects(selectedUser);

    return allUsers.filter((user) => {
      const userActiveProjects = this.getActiveUserProjects(user);

      return userActiveProjects.some(pr => selectedUserActiveProjects.includes(pr));
    });
  }

  private getActiveUserProjects(user: UserEntity): string[] {
    return user.projects
      .filter(p => this.isActive(p))
      .filter(p => p.project)
      .map(p => p.project.toString());
  }

  private isActive(p): boolean {
    p.dateStart = p.dateStart ? p.dateStart : moment('1900-01-01').format();
    p.dateEnd = p.dateEnd ? p.dateEnd : moment('2100-01-01').format();
    return moment().isBetween(p.dateStart, p.dateEnd);
  }
}