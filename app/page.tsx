'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const INITIAL_MISSIONS = [
  { id: 'water', group: 'essential', icon: '💧', title: '수분섭취 · Water Intake', sub: '하루 1.5~2L', done: false },
  { id: 'juice', group: 'essential', icon: '🥤', title: 'PM 주스 섭취 · PM Juice', sub: '파워칵테일 · 액티바이즈', done: false },
  { id: 'diet', group: 'essential', icon: '🥗', title: '식단 관리 · Diet Control', sub: '탄수화물 절반, 저녁 쉐이크', done: false },
  { id: 'walk', group: 'essential', icon: '🚶', title: '걷기 · Walk 15min+', sub: '식후 가벼운 산책', done: false },
  { id: 'sun', group: 'essential', icon: '☀️', title: '햇볕보기 · Get Sunlight', sub: '야외 10분 이상', done: false },
  { id: 'wake', group: 'wellbeing', icon: '⏰', title: '기상 체크 · Wake‑up', sub: '06:00 기상 인증', done: false },
  { id: 'oil', group: 'wellbeing', icon: '🦷', title: '오일풀링 · Oil Pulling', sub: '공복 10~15분', done: false },
  { id: 'journal', group: 'wellbeing', icon: '📓', title: '감사일기 · Gratitude Journal', sub: '하루 3줄 기록', done: false },
  { id: 'med', group: 'wellbeing', icon: '🧘', title: '명상 · Meditation', sub: '5~10분 호흡 명상', done: false },
  { id: 'sleep', group: 'wellbeing', icon: '🌙', title: '숙면 관리 · Sleep Care', sub: '족욕 + 리스토레이트', done: false },
];

export default function Home() {
  const [currentTab, setCurrentTab] = useState<'today' | 'class' | 'record'>('today');
  const [missions, setMissions] = useState(INITIAL_MISSIONS);
  const [confettis, setConfettis] = useState<any[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  // 인증 및 프로필
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 강의 데이터 및 사용자 Day
  const [lectures, setLectures] = useState<any[]>([]);
  const [userDay, setUserDay] = useState(1);
  const [selectedLecture, setSelectedLecture] = useState<any>(null);

  // 닉네임 수정 모달
  const [isEditingName, setIsEditingName] = useState(false);
  const [inputNickname, setInputNickname] = useState('');
  const [savingName, setSavingName] = useState(false);

  // 신체 정보 설정 모달
  const [isEditingBodyProfile, setIsEditingBodyProfile] = useState(false);
  const [inputHeight, setInputHeight] = useState('');
  const [inputTargetWeight, setInputTargetWeight] = useState('');
  const [savingBody, setSavingBody] = useState(false);

  // 체중 기록 관련 상태
  const [weightRecords, setWeightRecords] = useState<any[]>([]);
  const [inputWeight, setInputWeight] = useState('');
  const [inputMemo, setInputMemo] = useState('');
  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [recordViewRange, setRecordViewRange] = useState<'7days' | 'all'>('7days');

  // 전체 기간 미션 로그 (일자별 카운트용)
  const [allMissionLogs, setAllMissionLogs] = useState<any[]>([]);

  // 한국 시간(KST) 기준 YYYY-MM-DD 문자열 추출
  const toKSTDateString = (dateInput: Date | string = new Date()) => {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    // en-CA 로케일은 YYYY-MM-DD 형식을 보장합니다.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  };

  const getTodayString = () => {
    return toKSTDateString(new Date());
  };

  // Day 계산 (한국 날짜 KST 기준 오차 없는 자정 기준 계산)
  const calculateUserDay = (approvedAt: string | null) => {
    if (!approvedAt) return 1;

    const todayYMD = toKSTDateString(new Date());
    const approvedYMD = toKSTDateString(approvedAt);

    const [tY, tM, tD] = todayYMD.split('-').map(Number);
    const [aY, aM, aD] = approvedYMD.split('-').map(Number);

    const utcToday = Date.UTC(tY, tM - 1, tD);
    const utcApproved = Date.UTC(aY, aM - 1, aD);

    const diffDays = Math.floor((utcToday - utcApproved) / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  };

  // 특정 Day의 한국 날짜 YYYY-MM-DD 구하기
  const getDateOfDay = (approvedAt: string | null, dayNum: number) => {
    if (!approvedAt) return '';
    const approvedYMD = toKSTDateString(approvedAt);
    const [aY, aM, aD] = approvedYMD.split('-').map(Number);
    const baseUtc = Date.UTC(aY, aM - 1, aD);
    const targetUtc = new Date(baseUtc + (dayNum - 1) * 24 * 60 * 60 * 1000);
    return targetUtc.toISOString().split('T')[0];
  };

  // BMI 계산
  const calculateBMI = (heightCm: number, weightKg: number) => {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return 0;
    const heightM = heightCm / 100;
    return Number((weightKg / (heightM * heightM)).toFixed(1));
  };

  const getBmiStatus = (bmi: number) => {
    if (!bmi || bmi <= 0) return { text: '측정 전', color: '#888' };
    if (bmi < 18.5) return { text: '저체중', color: '#68D391' };
    if (bmi < 23) return { text: '정상', color: '#3FD6A6' };
    if (bmi < 25) return { text: '과체중', color: '#F6AD55' };
    return { text: '비만', color: '#FC8181' };
  };

  // 사용자의 모든 미션 로그 로드
  const loadUserMissionLogs = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('mission_logs')
        .select('*')
        .eq('user_id', userId);

      if (!error && data) {
        setAllMissionLogs(data);

        // 오늘 미션 상태 반영
        const todayStr = getTodayString();
        const todayCompleted = new Set(
          data.filter(d => d.log_date === todayStr && d.completed).map(d => d.mission_id)
        );
        setMissions(INITIAL_MISSIONS.map(m => ({
          ...m,
          done: todayCompleted.has(m.id),
        })));
        if (todayCompleted.size === INITIAL_MISSIONS.length) {
          setHasCelebrated(true);
        }
      }
    } catch (err) {
      console.error('미션 로그 로드 실패:', err);
    }
  };

  // 체중 기록 로드
  const loadWeightRecords = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('weight_records')
        .select('*')
        .eq('user_id', userId)
        .order('record_date', { ascending: true });

      if (!error && data) {
        setWeightRecords(data);
        const todayStr = getTodayString();
        const todayRec = data.find(r => r.record_date === todayStr);
        if (todayRec) {
          setInputWeight(String(todayRec.weight));
          setInputMemo(todayRec.memo || '');
        }
      }
    } catch (err) {
      console.error('체중 기록 로드 실패:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadLectures = async () => {
      const { data } = await supabase.from('lectures').select('*').order('day', { ascending: true });
      if (data && isMounted) {
        setLectures(data);
        if (data.length > 0) setSelectedLecture(data[0]);
      }
    };

    const syncUserData = async (currentUser: any) => {
      if (!currentUser || !isMounted) return;
      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileData && isMounted) {
          setProfile(profileData);
          setInputNickname(profileData.nickname || '');
          setInputHeight(profileData.height ? String(profileData.height) : '');
          setInputTargetWeight(profileData.target_weight ? String(profileData.target_weight) : '');
          setUserDay(calculateUserDay(profileData.approved_at));
        } else if (isMounted) {
          const initialName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '참가자';
          const newProfile = {
            id: currentUser.id,
            nickname: initialName,
            status: 'pending',
          };
          await supabase.from('profiles').upsert([newProfile]);
          setProfile(newProfile);
          setInputNickname(initialName);
        }

        await loadUserMissionLogs(currentUser.id);
        await loadWeightRecords(currentUser.id);
      } catch (err) {
        console.error('프로필 로드 에러:', err);
      }
    };

    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          setUser(session.user);
          await syncUserData(session.user);
        }
      } catch (err) {
        console.error('세션 에러:', err);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    getInitialSession();
    loadLectures();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user && isMounted) {
        setUser(session.user);
        await syncUserData(session.user);
      } else if (!session && isMounted) {
        setUser(null);
        setProfile(null);
      }
      if (isMounted) setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleKakaoLogin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qjtyqfuqtrlxkpanxdti.supabase.co';
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=kakao&redirect_to=${encodeURIComponent(redirectUrl)}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNickname.trim() || !user) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname: inputNickname.trim() })
        .eq('id', user.id);

      if (!error) {
        setProfile((prev: any) => ({ ...prev, nickname: inputNickname.trim() }));
        setIsEditingName(false);
        alert('참가자 정보가 변경되었습니다!');
      }
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveBodyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingBody(true);

    const h = parseFloat(inputHeight) || null;
    const tw = parseFloat(inputTargetWeight) || null;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ height: h, target_weight: tw })
        .eq('id', user.id);

      if (!error) {
        setProfile((prev: any) => ({ ...prev, height: h, target_weight: tw }));
        setIsEditingBodyProfile(false);
        alert('신체 및 목표 설정이 저장되었습니다!');
      }
    } finally {
      setSavingBody(false);
    }
  };

  const handleSaveWeightRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const w = parseFloat(inputWeight);
    if (isNaN(w) || w <= 0) {
      alert('올바른 체중을 입력해 주세요.');
      return;
    }

    setIsSavingRecord(true);
    const todayStr = getTodayString();
    const userHeight = profile?.height ? Number(profile.height) : 0;
    const calculatedBmi = userHeight > 0 ? calculateBMI(userHeight, w) : null;

    try {
      const { error } = await supabase.from('weight_records').upsert({
        user_id: user.id,
        record_date: todayStr,
        weight: w,
        bmi: calculatedBmi,
        memo: inputMemo.trim(),
      }, { onConflict: 'user_id,record_date' });

      if (error) {
        alert(`저장 실패: ${error.message}`);
      } else {
        alert('오늘의 체중과 BMI가 기록되었습니다!');
        await loadWeightRecords(user.id);
      }
    } finally {
      setIsSavingRecord(false);
    }
  };

  // 미션 체크 클릭
  const toggleMission = async (id: string) => {
    if (!user) return;
    const target = missions.find(m => m.id === id);
    if (!target) return;
    const nextDone = !target.done;
    const todayStr = getTodayString();

    const updated = missions.map(m => (m.id === id ? { ...m, done: nextDone } : m));
    setMissions(updated);

    // 전체 미션 로그 상태에도 즉시 반영
    setAllMissionLogs(prev => {
      const filtered = prev.filter(l => !(l.log_date === todayStr && l.mission_id === id));
      return [...filtered, { user_id: user.id, log_date: todayStr, mission_id: id, completed: nextDone }];
    });

    const allDone = updated.every(m => m.done);
    if (allDone && !hasCelebrated) {
      setHasCelebrated(true);
      fireConfetti();
    } else if (!allDone && hasCelebrated) {
      setHasCelebrated(false);
    }

    try {
      await supabase.from('mission_logs').upsert({
        user_id: user.id,
        log_date: todayStr,
        mission_id: id,
        completed: nextDone,
      }, { onConflict: 'user_id,log_date,mission_id' });
    } catch (err) {
      console.error('미션 저장 에러:', err);
    }
  };

  const fireConfetti = () => {
    const colors = ['#D9B24C', '#3FD6A6'];
    const pieces = Array.from({ length: 32 }, (_, i) => ({
      id: Date.now() + i,
      left: `${10 + Math.random() * 80}%`,
      bg: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 6,
      rot: `${Math.random() * 360}deg`,
      duration: 1.4 + Math.random() * 0.8,
      delay: Math.random() * 0.2,
    }));
    setConfettis(pieces);
    setShowCelebration(true);
    setTimeout(() => setConfettis([]), 2600);
    setTimeout(() => setShowCelebration(false), 2400);
  };

  const essentialMissions = missions.filter(m => m.group === 'essential');
  const essentialDone = essentialMissions.filter(m => m.done).length;
  const wellbeingMissions = missions.filter(m => m.group === 'wellbeing');
  const wellbeingDone = wellbeingMissions.filter(m => m.done).length;
  const totalPercent = Math.round(((essentialDone + wellbeingDone) / missions.length) * 100);

  const todayLecture = lectures.find(l => l.day === userDay) || {
    day: userDay,
    title: '의지력이 아닌 뇌를 속이는 1%의 기적',
    description: '"다이어트, 매번 의지력 부족으로 실패하셨나요? 여러분의 잘못이 아닙니다."',
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'www.youtube.com/embed/');
    return url;
  };

  // 누적 완주 일수 계산 (10개 올클리어한 날짜의 총 개수)
  const completedDaysCount = useMemo(() => {
    const dateCountMap: { [date: string]: number } = {};
    const todayStr = getTodayString();

    allMissionLogs.forEach(log => {
      if (log.log_date !== todayStr && log.completed) {
        dateCountMap[log.log_date] = (dateCountMap[log.log_date] || 0) + 1;
      }
    });

    let count = Object.values(dateCountMap).filter(
      cnt => cnt >= INITIAL_MISSIONS.length
    ).length;

    if (missions.every(m => m.done)) {
      count += 1;
    }

    return count;
  }, [allMissionLogs, missions]);

  // Day별 미션 달성 히스토리 데이터 생성 (Day 1 ~ userDay)
  const missionHistoryList = useMemo(() => {
    const list: any[] = [];
    const maxDay = Math.max(1, Math.min(30, userDay));
    const todayDoneCount = missions.filter(m => m.done).length;
    const todayStr = getTodayString();

    for (let d = 1; d <= maxDay; d++) {
      const isToday = d === userDay;
      const dateStr = isToday ? todayStr : (profile?.approved_at ? getDateOfDay(profile.approved_at, d) : '');
      
      const doneCount = isToday 
        ? todayDoneCount 
        : allMissionLogs.filter(l => l.log_date === dateStr && l.completed).length;

      const isComplete = doneCount === INITIAL_MISSIONS.length;

      list.push({
        day: d,
        date: dateStr,
        doneCount,
        total: INITIAL_MISSIONS.length,
        isToday,
        isComplete,
      });
    }

    if (recordViewRange === '7days') {
      return list.slice(-7);
    }
    return list;
  }, [userDay, profile?.approved_at, allMissionLogs, recordViewRange, missions]);

  // 체중 기록 통계
  const displayedRecords = useMemo(() => {
    if (recordViewRange === '7days') {
      return weightRecords.slice(-7);
    }
    return weightRecords.slice(-30);
  }, [weightRecords, recordViewRange]);

  const startWeight = weightRecords.length > 0 ? weightRecords[0].weight : null;
  const latestRecord = weightRecords.length > 0 ? weightRecords[weightRecords.length - 1] : null;
  const currentWeight = latestRecord ? latestRecord.weight : null;
  const weightChange = startWeight && currentWeight ? Number((currentWeight - startWeight).toFixed(1)) : 0;
  
  const liveBmi = useMemo(() => {
    const h = profile?.height ? Number(profile.height) : 0;
    const w = parseFloat(inputWeight);
    if (h > 0 && w > 0) return calculateBMI(h, w);
    return latestRecord?.bmi || 0;
  }, [profile?.height, inputWeight, latestRecord]);

  const liveBmiInfo = getBmiStatus(liveBmi);

  if (authLoading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
        <div style={{ color: '#888', fontSize: '14px' }}>잠시만 기다려 주세요...</div>
      </main>
    );
  }

  // 1. 비로그인
  if (!user) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '390px', backgroundColor: '#121212', borderRadius: '28px', border: '1px solid #262626', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '44px', marginBottom: '16px' }}>⚡</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>Neuro Cell_Fit</h1>
          <p style={{ fontSize: '13px', color: '#a3a3a3', lineHeight: 1.6, marginBottom: '36px' }}>
            의지력이 아닌 뇌를 깨우는 1% 루틴<br />챌린지에 오신 것을 환영합니다.
          </p>
          <button
            type="button"
            onClick={handleKakaoLogin}
            style={{ width: '100%', maxWidth: '280px', padding: '14px 20px', backgroundColor: '#FEE500', color: '#191919', fontWeight: 700, fontSize: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>💬</span> 카카오 1초 로그인
          </button>
          <p style={{ fontSize: '11px', color: '#737373', lineHeight: 1.5, marginTop: '14px', maxWidth: '260px' }}>
            로그인 시 Neuro Cell_Fit의 <span style={{ textDecoration: 'underline' }}>이용약관</span> 및 <span style={{ textDecoration: 'underline' }}>개인정보 수집·이용</span>에 동의하게 됩니다.
          </p>
        </div>
      </main>
    );
  }

  // 2. 만료 화면
  if (profile?.status === 'approved' && userDay > 30) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '390px', backgroundColor: '#121212', borderRadius: '28px', border: '1px solid #262626', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '44px', marginBottom: '16px' }}>🏁</div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
            챌린지 솔루션 기간이 만료되었습니다
          </h2>
          <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.6, marginBottom: '24px' }}>
            수고 많으셨습니다, <strong>{profile?.nickname}</strong>님!<br />
            다음 기수 재참여 또는 연장은 코치님께 문의해 주세요.
          </p>
          <button onClick={handleLogout} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#222', color: '#aaa', cursor: 'pointer', fontSize: '12px' }}>
            로그아웃
          </button>
        </div>
      </main>
    );
  }

  // 3. 대기 화면
  if (profile?.status !== 'approved') {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        {isEditingName && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
            <form onSubmit={handleSaveNickname} style={{ width: '100%', maxWidth: '340px', backgroundColor: '#181818', borderRadius: '20px', border: '1px solid #333', padding: '24px', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>참가자 정보 수정</h3>
                <button type="button" onClick={() => setIsEditingName(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '16px', cursor: 'pointer' }}>✕</button>
              </div>
              <p style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.5, marginBottom: '16px' }}>
                입금 확인 및 팀 구분을 위해 수정해 주세요.<br />
                <span style={{ color: '#3FD6A6', fontWeight: 600 }}>형식: 지역 / 성함 / 추천인</span>
              </p>
              <input
                type="text"
                value={inputNickname}
                onChange={e => setInputNickname(e.target.value)}
                placeholder="예: 부산 / 홍길동 / 김스폰서"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#262626', color: '#fff', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setIsEditingName(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#262626', color: '#aaa', cursor: 'pointer' }}>취소</button>
                <button type="submit" disabled={savingName} style={{ flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#3FD6A6', color: '#000', fontWeight: 700, cursor: 'pointer' }}>
                  {savingName ? '저장 중...' : '저장 완료'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ width: '100%', maxWidth: '390px', backgroundColor: '#121212', borderRadius: '28px', border: '1px solid #262626', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
          <button onClick={handleLogout} style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
            로그아웃
          </button>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
            입금 확인 및 참가 승인 대기 중
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '8px 0 16px' }}>
            <span style={{ fontSize: '15px', color: '#3FD6A6', fontWeight: 600 }}>{profile?.nickname || '참가자'}</span>
            <button
              onClick={() => setIsEditingName(true)}
              style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#ccc', fontSize: '11px', cursor: 'pointer' }}
            >
              ✏️ 정보 수정
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#888', lineHeight: 1.6, maxWidth: '280px', margin: 0 }}>
            원활한 입금 확인을 위해 <strong style={{ color: '#bbb' }}>[지역 / 성함 / 추천인]</strong> 형식으로 수정해 주시면 빠른 승인이 가능합니다.
          </p>
        </div>
      </main>
    );
  }

  // 4. 메인 화면
  return (
    <main className="app-shell pb-20">
      {isEditingName && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <form onSubmit={handleSaveNickname} style={{ width: '100%', maxWidth: '340px', backgroundColor: '#181818', borderRadius: '20px', border: '1px solid #333', padding: '24px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>참가자 정보 수정</h3>
              <button type="button" onClick={() => setIsEditingName(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.5, marginBottom: '16px' }}>
              입금 확인 및 팀 구분을 위해 수정해 주세요.<br />
              <span style={{ color: '#3FD6A6', fontWeight: 600 }}>형식: 지역 / 성함 / 추천인</span>
            </p>
            <input
              type="text"
              value={inputNickname}
              onChange={e => setInputNickname(e.target.value)}
              placeholder="예: 부산 / 홍길동 / 김스폰서"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#262626', color: '#fff', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsEditingName(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#262626', color: '#aaa', cursor: 'pointer' }}>취소</button>
              <button type="submit" disabled={savingName} style={{ flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#3FD6A6', color: '#000', fontWeight: 700, cursor: 'pointer' }}>
                {savingName ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isEditingBodyProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <form onSubmit={handleSaveBodyProfile} style={{ width: '100%', maxWidth: '340px', backgroundColor: '#181818', borderRadius: '20px', border: '1px solid #333', padding: '24px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>신체 정보 & 목표 설정</h3>
              <button type="button" onClick={() => setIsEditingBodyProfile(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '16px', cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: '12px', color: '#aaa', lineHeight: 1.5, marginBottom: '16px' }}>
              정확한 BMI 산출과 체중 감량 추적을 위해 입력해 주세요.
            </p>

            <label style={{ display: 'block', fontSize: '12px', color: '#bbb', marginBottom: '6px' }}>나의 키 (cm)</label>
            <input
              type="number"
              step="0.1"
              value={inputHeight}
              onChange={e => setInputHeight(e.target.value)}
              placeholder="예: 165.0"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#262626', color: '#fff', fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box', outline: 'none' }}
            />

            <label style={{ display: 'block', fontSize: '12px', color: '#bbb', marginBottom: '6px' }}>목표 체중 (kg)</label>
            <input
              type="number"
              step="0.1"
              value={inputTargetWeight}
              onChange={e => setInputTargetWeight(e.target.value)}
              placeholder="예: 52.0"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #444', backgroundColor: '#262626', color: '#fff', fontSize: '14px', marginBottom: '18px', boxSizing: 'border-box', outline: 'none' }}
            />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setIsEditingBodyProfile(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#262626', color: '#aaa', cursor: 'pointer' }}>취소</button>
              <button type="submit" disabled={savingBody} style={{ flex: 1.5, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#3FD6A6', color: '#000', fontWeight: 700, cursor: 'pointer' }}>
                {savingBody ? '저장 중...' : '저장 완료'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="device-screen">
        {confettis.map(c => (
          <div
            key={c.id}
            className="confetti-piece"
            style={{
              left: c.left,
              width: `${c.size}px`,
              height: `${c.size * 1.6}px`,
              backgroundColor: c.bg,
              transform: `rotate(${c.rot})`,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}

        {showCelebration && (
          <div className="toast-center">
            <div style={{ fontSize: '32px' }}>🎉</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '6px' }}>오늘 미션 올클리어!</div>
            <div style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '4px' }}>세포가 반응하기 시작했어요</div>
          </div>
        )}

        {/* 상단 헤더 */}
        <div className="top-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700 }}>Neuro </span>
            <span style={{ color: 'var(--accent-a)', fontWeight: 700 }}>Cell_Fit</span>
          </div>
          <button onClick={handleLogout} style={{ fontSize: '11px', color: 'var(--text-mid)', background: 'none', border: 'none', cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>

        <div className="scroll-body">
          {/* 탭 1: 투데이 */}
          {currentTab === 'today' && (
            <>
              <div className="greeting">
                <div className="date">{getTodayString()} · TODAY</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1>안녕하세요, <em>{profile?.nickname || '참여자'}</em>님 👋</h1>
                  <button
                    onClick={() => setIsEditingName(true)}
                    style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid #333', backgroundColor: '#1e1e1e', color: '#999', fontSize: '10px', cursor: 'pointer' }}
                  >
                    ✏️ 변경
                  </button>
                </div>
              </div>

              {/* 상단 상태 스트립 */}
              <div className="status-strip">
                <div className="cell">
                  <div className="num">Day {userDay}</div>
                  <div className="lab">CHALLENGE</div>
                </div>
                <div className="cell">
                  <div className="num" style={{ color: 'var(--accent-a)' }}>🔥 {completedDaysCount}일</div>
                  <div className="lab">완주 달성일</div>
                </div>
                <div className="cell">
                  <div className="num" style={{ color: 'var(--accent-b)' }}>{totalPercent}%</div>
                  <div className="lab">TODAY ROUTINE</div>
                </div>
              </div>

              <div className="lecture-hero" onClick={() => setCurrentTab('class')} style={{ cursor: 'pointer' }}>
                <div className="daytag">DAY {todayLecture.day}</div>
                <h3 className="ttl">{todayLecture.title}</h3>
                <div className="sub">{todayLecture.description || '오늘의 강의를 시청하고 루틴을 시작해보세요!'}</div>
              </div>

              <div className="mission-card">
                <div className="mission-head">
                  <h2>필수 루틴 · Essential</h2>
                  <div className="cnt">{essentialDone}/{essentialMissions.length}</div>
                </div>
                <div className="mission-progress">
                  <div className="track">
                    <div className="fill" style={{ width: `${(essentialDone / essentialMissions.length) * 100}%` }} />
                  </div>
                </div>
                <div className="mission-list">
                  {essentialMissions.map(m => (
                    <div
                      key={m.id}
                      className={`mission-row ${m.done ? 'done' : ''}`}
                      onClick={() => toggleMission(m.id)}
                    >
                      <div className="m-ic">{m.icon}</div>
                      <div className="m-txt">
                        <div className="m-t">{m.title}</div>
                        <div className="m-s">{m.sub}</div>
                      </div>
                      <div className="m-chk">✓</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mission-card">
                <div className="mission-head">
                  <h2>웰빙 루틴 · Wellbeing</h2>
                  <div className="cnt" style={{ color: 'var(--accent-b)' }}>{wellbeingDone}/{wellbeingMissions.length}</div>
                </div>
                <div className="mission-progress">
                  <div className="track">
                    <div className="fill" style={{ width: `${(wellbeingDone / wellbeingMissions.length) * 100}%` }} />
                  </div>
                </div>
                <div className="mission-list">
                  {wellbeingMissions.map(m => (
                    <div
                      key={m.id}
                      className={`mission-row ${m.done ? 'done' : ''}`}
                      onClick={() => toggleMission(m.id)}
                    >
                      <div className="m-ic">{m.icon}</div>
                      <div className="m-txt">
                        <div className="m-t">{m.title}</div>
                        <div className="m-s">{m.sub}</div>
                      </div>
                      <div className="m-chk">✓</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="msg-card">
                <div className="k">COACH'S NOTE · 매일 업데이트</div>
                <p>가짜 배고픔은 뇌가 만든 착각이에요. 오늘도 나 자신을 믿고 루틴을 지켜봐요 🌤️</p>
              </div>
            </>
          )}

          {/* 탭 2: 클래스 */}
          {currentTab === 'class' && (
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: '18px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>🎓 클래스 보관함</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '4px' }}>
                  현재 <strong>Day {userDay}</strong>까지 오픈되었습니다. 지난 강의는 언제든 복습 가능합니다.
                </p>
              </div>

              {selectedLecture && (
                <div style={{ marginBottom: '20px', backgroundColor: '#161616', borderRadius: '16px', overflow: 'hidden', border: '1px solid #333' }}>
                  {selectedLecture.video_url ? (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                      <iframe
                        src={getEmbedUrl(selectedLecture.video_url)}
                        title={selectedLecture.title}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                      🎬 영상 준비 중입니다.
                    </div>
                  )}
                  <div style={{ padding: '16px' }}>
                    <span style={{ fontSize: '11px', color: '#3FD6A6', fontWeight: 600 }}>DAY {selectedLecture.day}</span>
                    <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '4px 0 6px' }}>{selectedLecture.title}</h3>
                    <p style={{ fontSize: '12px', color: '#aaa', margin: 0, lineHeight: 1.5 }}>{selectedLecture.description}</p>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {lectures.map(lec => {
                  const isUnlocked = lec.day <= userDay;
                  return (
                    <div
                      key={lec.day}
                      onClick={() => isUnlocked && setSelectedLecture(lec)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        backgroundColor: isUnlocked ? '#181818' : '#111',
                        borderRadius: '12px',
                        border: isUnlocked ? '1px solid #2a2a2a' : '1px solid #1a1a1a',
                        cursor: isUnlocked ? 'pointer' : 'not-allowed',
                        opacity: isUnlocked ? 1 : 0.45,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: isUnlocked ? 'rgba(63, 214, 166, 0.15)' : '#222',
                            color: isUnlocked ? '#3FD6A6' : '#666',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                          }}
                        >
                          {lec.day}
                        </div>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isUnlocked ? '#fff' : '#888' }}>
                            {lec.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-mid)', marginTop: '2px' }}>
                            {lec.week}
                          </div>
                        </div>
                      </div>

                      <div>
                        {isUnlocked ? (
                          <span style={{ fontSize: '11px', color: '#3FD6A6', fontWeight: 600 }}>▶ 시청</span>
                        ) : (
                          <span style={{ fontSize: '12px' }}>🔒</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 탭 3: 나의 기록 */}
          {currentTab === 'record' && (
            <div style={{ padding: '16px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>📊 나의 기록</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-mid)', marginTop: '2px' }}>
                    매일의 루틴 달성과 신체 변화를 기록합니다.
                  </p>
                </div>
                <button
                  onClick={() => setIsEditingBodyProfile(true)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #444',
                    backgroundColor: '#1f1f1f',
                    color: '#3FD6A6',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ⚙️ 키/목표 설정
                </button>
              </div>

              {/* 신체 상태 요약 카드 행 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: '#161616', padding: '12px 8px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#888' }}>현재 체중</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                    {currentWeight ? `${currentWeight}kg` : '-'}
                  </div>
                  <div style={{ fontSize: '10px', color: weightChange <= 0 ? '#3FD6A6' : '#FC8181', marginTop: '2px' }}>
                    {weightChange > 0 ? `+${weightChange}kg` : `${weightChange}kg`}
                  </div>
                </div>

                <div style={{ backgroundColor: '#161616', padding: '12px 8px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#888' }}>목표 체중</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--accent-a)', marginTop: '4px' }}>
                    {profile?.target_weight ? `${profile.target_weight}kg` : '미설정'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
                    {profile?.target_weight && currentWeight
                      ? `남은 목표 ${(currentWeight - Number(profile.target_weight)).toFixed(1)}kg`
                      : '키/목표 설정'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#161616', padding: '12px 8px', borderRadius: '12px', border: '1px solid #282828', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#888' }}>나의 BMI</div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: liveBmiInfo.color, marginTop: '4px' }}>
                    {liveBmi > 0 ? liveBmi : '-'}
                  </div>
                  <div style={{ fontSize: '10px', color: liveBmiInfo.color, marginTop: '2px' }}>
                    {liveBmiInfo.text}
                  </div>
                </div>
              </div>

              {/* 일자별 미션 달성 현황 카드 리스트 */}
              <div style={{ backgroundColor: '#141414', borderRadius: '16px', padding: '16px', border: '1px solid #222', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '15px' }}>🎯</span>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>일차별 루틴 달성 현황</h3>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--accent-a)', fontWeight: 600 }}>
                    총 {completedDaysCount}일 완주 달성 🔥
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {missionHistoryList.slice().reverse().map(item => (
                    <div
                      key={item.day}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: item.isToday ? 'rgba(63, 214, 166, 0.08)' : '#1c1c1c',
                        borderRadius: '10px',
                        border: item.isToday ? '1px solid #3FD6A6' : '1px solid #262626',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: item.isToday ? '#3FD6A6' : '#bbb',
                            minWidth: '46px',
                          }}
                        >
                          Day {item.day}
                        </div>
                        <div style={{ fontSize: '11px', color: '#777' }}>
                          {item.date || '-'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.isToday ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>
                              {item.doneCount}/{item.total}개
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: item.isComplete ? '#3FD6A6' : '#2a2a2a',
                                color: item.isComplete ? '#000' : 'var(--accent-a)',
                                fontWeight: 700,
                              }}
                            >
                              {item.isComplete ? '완료! 🎉' : '진행 중 (화이팅! 🔥)'}
                            </span>
                          </div>
                        ) : item.isComplete ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: '#aaa' }}>10/10개</span>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(63, 214, 166, 0.15)',
                                color: '#3FD6A6',
                                fontWeight: 600,
                              }}
                            >
                              완료! 🎉
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '12px', color: '#888' }}>
                              {item.doneCount}/{item.total}개
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#222',
                                color: '#888',
                              }}
                            >
                              미완료
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 오늘 체중 기록 폼 */}
              <div style={{ backgroundColor: '#161616', borderRadius: '16px', padding: '18px 16px', border: '1px solid #282828', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#fff' }}>✍️ 오늘의 체중 기록하기</h3>
                  <span style={{ fontSize: '11px', color: '#3FD6A6' }}>{getTodayString()}</span>
                </div>

                <form onSubmit={handleSaveWeightRecord}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="체중 (kg) 입력"
                        value={inputWeight}
                        onChange={e => setInputWeight(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '10px',
                          border: '1px solid #3a3a3a',
                          backgroundColor: '#222',
                          color: '#fff',
                          fontSize: '14px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#202020', borderRadius: '10px', border: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#888' }}>예상 BMI</span>
                      <span style={{ fontSize: '14px', fontWeight: 'bold', color: liveBmiInfo.color }}>
                        {liveBmi > 0 ? `${liveBmi} (${liveBmiInfo.text})` : '키 설정 필요'}
                      </span>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="오늘의 컨디션이나 한 줄 소감 (선택)"
                    value={inputMemo}
                    onChange={e => setInputMemo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #333',
                      backgroundColor: '#202020',
                      color: '#ddd',
                      fontSize: '12px',
                      marginBottom: '12px',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />

                  <button
                    type="submit"
                    disabled={isSavingRecord}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: 'none',
                      backgroundColor: '#3FD6A6',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    {isSavingRecord ? '기록 저장 중...' : '오늘의 체중 & BMI 저장'}
                  </button>
                </form>
              </div>

              {/* 체중 기록 히스토리 뷰 & 기간 토글 */}
              <div style={{ backgroundColor: '#141414', borderRadius: '16px', padding: '16px', border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', margin: 0 }}>📈 체중 변화 추이</h3>
                  <div style={{ display: 'flex', gap: '4px', backgroundColor: '#222', padding: '3px', borderRadius: '8px' }}>
                    <button
                      onClick={() => setRecordViewRange('7days')}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '10px',
                        cursor: 'pointer',
                        backgroundColor: recordViewRange === '7days' ? '#3FD6A6' : 'transparent',
                        color: recordViewRange === '7days' ? '#000' : '#888',
                        fontWeight: recordViewRange === '7days' ? 700 : 400,
                      }}
                    >
                      최근 7일
                    </button>
                    <button
                      onClick={() => setRecordViewRange('all')}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '10px',
                        cursor: 'pointer',
                        backgroundColor: recordViewRange === 'all' ? '#3FD6A6' : 'transparent',
                        color: recordViewRange === 'all' ? '#000' : '#888',
                        fontWeight: recordViewRange === 'all' ? 700 : 400,
                      }}
                    >
                      솔루션 전체
                    </button>
                  </div>
                </div>

                {displayedRecords.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px 10px', color: '#666', fontSize: '12px' }}>
                    아직 기록된 체중 데이터가 없습니다.<br />오늘의 첫 체중을 입력해 보세요!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {displayedRecords.slice().reverse().map(rec => (
                      <div
                        key={rec.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          backgroundColor: '#1c1c1c',
                          borderRadius: '10px',
                          border: '1px solid #2a2a2a',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#eee' }}>
                            {rec.record_date}
                          </div>
                          {rec.memo && (
                            <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                              {rec.memo}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#3FD6A6' }}>
                            {rec.weight} kg
                          </span>
                          {rec.bmi && (
                            <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '8px' }}>
                              BMI {rec.bmi}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 탭바 */}
        <nav className="tabbar" style={{ left: 0, right: 0, width: '100%', boxSizing: 'border-box' }}>
          <button type="button" onClick={() => setCurrentTab('today')} className={`tab-item ${currentTab === 'today' ? 'active' : ''}`}>
            <span className="ic">📅</span>
            <span>투데이</span>
          </button>
          <button type="button" onClick={() => setCurrentTab('class')} className={`tab-item ${currentTab === 'class' ? 'active' : ''}`}>
            <span className="ic">🎓</span>
            <span>클래스</span>
          </button>
          <button type="button" onClick={() => setCurrentTab('record')} className={`tab-item ${currentTab === 'record' ? 'active' : ''}`}>
            <span className="ic">📊</span>
            <span>나의 기록</span>
          </button>
        </nav>
      </div>
    </main>
  );
}