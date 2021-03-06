import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { InputFile } from 'ngx-input-file';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsModel } from '../../shared/models/settings.model';
import { UpdateSettingsModel } from '../../shared/models/update-settings.model';

@Injectable({
  providedIn: 'root'
})
export class ConfigurationApiService {
  private readonly baseUrl = `${environment.baseUrl}/settings`;

  constructor(private http: HttpClient) {}

  public loadSettings(): Observable<SettingsModel> {
    return this.http.get<SettingsModel>(this.baseUrl);
  }

  public updateSettings(settings: UpdateSettingsModel): Observable<SettingsModel> {
    return this.http.post<SettingsModel>(this.baseUrl, settings);
  }

  public deleteLogo(): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/logo`);
  }

  public setLogo(inputFile: InputFile): Observable<void> {
    const formData = new FormData();

    /** Добавляем файл для случаев с файловым хранилищем */
    if (inputFile && inputFile.file) {
      formData.append('file', inputFile.file);
    }

    return this.http.post<void>(`${this.baseUrl}/logo`, formData);
  }
}
