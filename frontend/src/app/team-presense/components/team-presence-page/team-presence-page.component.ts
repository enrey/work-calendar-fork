import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Params, Router } from '@angular/router';
import * as moment from 'moment';
import { BehaviorSubject, forkJoin, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, map, share, switchMap } from 'rxjs/operators';
import { DictionaryApiService } from '../../../core/services/dictionary-api.service';
import { locationsDictionary } from '../../../shared/const/locations-dictionary.const';
import { DictionaryModel } from '../../../shared/models/dictionary.model';
import { PresenceModel } from '../../../shared/models/presence.page.model';
import { HolidaysApiService } from '../../../core/services/holidays-api.service';
import { HolidaysModel } from '../../../shared/models/holidays.model';
import { TaskApiService } from '../../../core/services/task-api.service';
import { Employee } from '../../../shared/models/employee.model';
import { ContextStoreService } from '../../../core/store/context-store.service';
import { SelectInputDataModel } from '../../../shared/components/single-select/single-select.component';

@Component({
  selector: 'app-team-presence',
  templateUrl: './team-presence-page.component.html',
  styleUrls: ['./team-presence-page.component.scss']
})
export class TeamPresencePageComponent implements OnInit, OnDestroy {
  private qParamsSnapshotMonth = this.route.snapshot.queryParams.date;
  public date$ = new BehaviorSubject<moment.Moment>(
    this.qParamsSnapshotMonth ? moment(this.qParamsSnapshotMonth, 'MM-YYYY') : moment()
  );

  public monthData$: Observable<PresenceModel[]>;
  public monthDays$: Observable<moment.Moment[]>;

  public filtersForm: FormGroup;
  public holidays: HolidaysModel[];
  public projects: SelectInputDataModel[];
  public jobPositions: SelectInputDataModel[];
  public subdivisions: SelectInputDataModel[];
  public locations: SelectInputDataModel[];

  private subscription = new Subscription();

  constructor(
    private tasksApi: TaskApiService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private dictionaryApi: DictionaryApiService,
    private holidaysApi: HolidaysApiService,
    private contextStoreService: ContextStoreService
  ) {}

  ngOnInit() {
    this.initFilterForm(this.route.snapshot.queryParams);

    this.monthDays$ = this.getMonthDays();

    this.getCommonData();

    this.monthData$ = this.date$.pipe(
      map(date => date.format('YYYY-MM-DD')),
      distinctUntilChanged(),
      switchMap(date => this.tasksApi.loadTasksByMonth(date)),
      map(this.filterTerminatedEmployees),
      share()
    );

    this.updateQueryParamsOnChange();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private filterTerminatedEmployees(presenceModels: PresenceModel[]): PresenceModel[] {
    const now = moment();

    return presenceModels.filter(({ employee }) => {
      if (!employee.terminationDate) {
        return true;
      }

      const endOfEmployeeTerminationMonth = moment(employee.terminationDate).endOf('month');

      return now.isBefore(endOfEmployeeTerminationMonth);
    });
  }

  private getCommonData() {
    const holidays$ = this.holidaysApi.getAllHolidays();
    const projects$ = this.dictionaryApi.getAll('project');
    const jobPositions$ = this.dictionaryApi.getAll('jobPosition');
    const subdivisions$ = this.dictionaryApi.getAll('subdivision');

    this.subscription.add(
      forkJoin([holidays$, projects$, jobPositions$, subdivisions$]).subscribe(res => {
        const [holidays, projects, jobPositions, subdivisions] = res;

        this.holidays = holidays;
        this.projects = projects.map(item => this.mapperToSelectInputDataModel(item));
        this.jobPositions = jobPositions.map(item => this.mapperToSelectInputDataModel(item));
        this.subdivisions = subdivisions.map(item => {
          return {
            value: item.name,
            name: item.name
          };
        });
        this.locations = locationsDictionary.map(item => {
          return {
            value: item,
            name: item
          };
        });
      })
    );
  }

  private mapperToSelectInputDataModel(item: DictionaryModel): SelectInputDataModel {
    return {
      value: item._id,
      name: item.name
    };
  }

  public prevMonth(): void {
    this.date$.next(this.date$.value.clone().subtract(1, 'months'));
  }

  public nextMonth(): void {
    this.date$.next(this.date$.value.clone().add(1, 'months'));
  }

  private updateQueryParamsOnChange() {
    this.subscription.add(
      this.date$.subscribe(date =>
        this.router.navigate([], {
          queryParams: { ...this.route.snapshot.queryParams, date: moment(date).format('MM-YYYY') }
        })
      )
    );

    this.subscription.add(
      this.filtersForm.valueChanges.subscribe(filters =>
        this.router.navigate([], {
          queryParams: { ...this.route.snapshot.queryParams, ...filters }
        })
      )
    );
  }

  private getMonthDays(): Observable<moment.Moment[]> {
    return this.date$.pipe(
      map(date => {
        const startOfMonth = date.clone().startOf('month');
        const daysInMonth = date.daysInMonth();

        return Array.from(Array(daysInMonth).keys()).map(i => startOfMonth.clone().add(i, 'day'));
      })
    );
  }

  private initFilterForm(filters?: Params): void {
    this.filtersForm = this.fb.group({
      name: [''],
      subdivision: [null],
      jobPosition: [null],
      project: [null],
      location: [null]
    });

    if (filters) {
      this.filtersForm.patchValue(filters);
    }

    this.subscription.add(
      this.contextStoreService
        .getCurrentUser$()
        .subscribe(res => this.filtersForm.patchValue({ project: this.getMainProject(res) }))
    );
  }

  // получаем основной на текущий момент проект
  // у залогиненого пользователя, с максимальным %
  private getMainProject(user: Employee): string {
    if (!user.projectsNew && !user.projectsNew.length) {
      return null;
    }

    const year = moment().year();
    const month = moment().month() + 1;

    // тк у проекта метадата - массив с инфой по месяцам,
    // мапим проекты, чтобы получить массив
    // с активными на текущий момент проектами, без массива метадат
    const activeProject = user.projectsNew
      .map(project => {
        const metadata = project.metadata.find(pr => pr.year === year && pr.month === month);
        return {
          project_name: project.project_name,
          project_id: project.project_id,
          percent: metadata ? metadata.percent : null
        };
      })
      .filter(p => p && p.percent)
      .sort((a, b) => b.percent - a.percent);

    if (!activeProject && !activeProject.length) {
      return null;
    }

    return activeProject[0].project_id;
  }
}
