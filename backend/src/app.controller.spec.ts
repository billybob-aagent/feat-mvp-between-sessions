import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('version', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('should return ok:true with version metadata', () => {
      process.env.RENDER_GIT_COMMIT = 'test-sha';
      process.env.BUILD_TIME = '2026-02-12T00:00:00Z';

      const result = appController.getVersion();
      expect(result.ok).toBe(true);
      expect(result.git_sha).toBe('test-sha');
      expect(result.built_at).toBe('2026-02-12T00:00:00Z');
    });
  });
});
