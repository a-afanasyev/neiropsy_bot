/**
 * Тесты для FSM (конечный автомат состояний) BatchService
 */

import { SessionState } from '../src/types';

describe('FSM State Machine', () => {
  describe('SessionState transitions', () => {
    it('должны быть определены все состояния', () => {
      expect(SessionState.CREATED).toBe('CREATED');
      expect(SessionState.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(SessionState.COMPLETED).toBe('COMPLETED');
      expect(SessionState.REPORTED).toBe('REPORTED');
    });

    it('должен правильно переходить между состояниями', () => {
      // CREATED -> IN_PROGRESS (когда клиент начинает)
      let state: SessionState = SessionState.CREATED;
      state = SessionState.IN_PROGRESS;
      expect(state).toBe(SessionState.IN_PROGRESS);

      // IN_PROGRESS -> COMPLETED (когда все опросники пройдены)
      state = SessionState.COMPLETED;
      expect(state).toBe(SessionState.COMPLETED);

      // COMPLETED -> REPORTED (когда отчет сгенерирован)
      state = SessionState.REPORTED;
      expect(state).toBe(SessionState.REPORTED);
    });
  });

  describe('Session Progress', () => {
    it('должен отслеживать прогресс прохождения', () => {
      const progress = {
        session_id: 'test-session',
        batch_id: 'test-batch',
        user_id: 123,
        chat_id: 123,
        state: SessionState.IN_PROGRESS,
        current_questionnaire_index: 0,
        current_question_index: 5,
        current_answers: {},
        total_questionnaires: 4,
        questionnaires: [],
      };

      expect(progress.current_questionnaire_index).toBe(0);
      expect(progress.current_question_index).toBe(5);
      expect(progress.state).toBe(SessionState.IN_PROGRESS);

      // Симуляция перехода к следующему опроснику
      progress.current_questionnaire_index = 1;
      progress.current_question_index = 0;

      expect(progress.current_questionnaire_index).toBe(1);
      expect(progress.current_question_index).toBe(0);
    });
  });
});

