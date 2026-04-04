import React, { useState, useEffect } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths,
  subMonths, parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, Video, MapPin, Clock, X } from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatTime } from '../utils/helpers';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Calendar.css';

export default function CalendarPage() {
  const { isManager } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [meetings, setMeetings] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMeeting, setViewMeeting] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMeetings(); }, [currentMonth]);

  const loadMeetings = async () => {
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd'T'00:00:00");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd'T'23:59:59");
    try {
      const res = await api.get(`/meetings?start=${start}&end=${end}`);
      setMeetings(res.data.meetings || []);
    } catch {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const getDayMeetings = (day) =>
    meetings.filter(m => isSameDay(parseISO(m.start_time), day));

  const weeks = (() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    const days = eachDayOfInterval({ start, end });
    const wks = [];
    for (let i = 0; i < days.length; i += 7) {
      wks.push(days.slice(i, i + 7));
    }
    return wks;
  })();

  const selectedMeetings = selectedDay ? getDayMeetings(selectedDay) : [];

  return (
    <>
      <Header title="Calendar" subtitle="Pre-sales meetings and schedule" />
      <div className="page-content calendar-page">
        <div className="calendar-layout">
          <div className="calendar-main">
            <div className="cal-nav">
              <button className="cal-nav-btn" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft size={16} />
              </button>
              <h2 className="cal-month-title">{format(currentMonth, 'MMMM yyyy')}</h2>
              <button className="cal-nav-btn" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight size={16} />
              </button>
              <button className="cal-today-btn" onClick={() => setCurrentMonth(new Date())}>Today</button>
              {isManager() && (
                <button className="cal-add-btn" onClick={() => setShowCreate(true)}>
                  <Plus size={13} /> Add Meeting
                </button>
              )}
            </div>

            <div className="cal-grid">
              <div className="cal-day-headers">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <div key={d} className={`cal-day-header ${i === 0 || i === 6 ? 'weekend' : ''}`}>{d}</div>
                ))}
              </div>

              {weeks.map((week, wi) => (
                <div key={wi} className="cal-week">
                  {week.map((day, di) => {
                    const dayMeetings = getDayMeetings(day);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                      <div
                        key={di}
                        className={`cal-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday(day) ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                        onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                      >
                        <div className="cal-day-num">{format(day, 'd')}</div>
                        <div className="cal-day-events">
                          {dayMeetings.slice(0, 3).map(m => (
                            <div
                              key={m.id}
                              className="cal-event"
                              onClick={e => { e.stopPropagation(); setViewMeeting(m); }}
                              title={m.title}
                            >
                              <span className="cal-event-time">{formatTime(m.start_time)}</span>
                              <span className="cal-event-title">{m.title}</span>
                            </div>
                          ))}
                          {dayMeetings.length > 3 && (
                            <div className="cal-event-more">+{dayMeetings.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="calendar-sidebar">
            {selectedDay ? (
              <>
                <div className="cal-sidebar-header">
                  <h3>Meetings</h3>
                  <span className="cal-sidebar-date-badge">{format(selectedDay, 'MMM d')}</span>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedDay(null)}>
                    <X size={14} />
                  </button>
                </div>
                {selectedMeetings.length === 0 ? (
                  <div className="cal-no-meetings">
                    <CalIcon size={32} color="#e2e8f0" />
                    <p>No meetings this day</p>
                    {isManager() && (
                      <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                        <Plus size={13} /> Schedule meeting
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cal-day-meetings">
                    {selectedMeetings.map(m => (
                      <div key={m.id} className="cal-meeting-card" onClick={() => setViewMeeting(m)}>
                        <div className="cal-meeting-time">
                          <Clock size={12} />
                          {formatTime(m.start_time)} – {formatTime(m.end_time)}
                        </div>
                        <div className="cal-meeting-title">{m.title}</div>
                        {m.client_company && (
                          <div className="cal-meeting-company">{m.client_company}</div>
                        )}
                        {m.organizer_name && (
                          <div className="cal-meeting-org">{m.organizer_name}</div>
                        )}
                        {(m.meeting_link || m.ms_teams_join_url) && (
                          <a
                            href={m.ms_teams_join_url || m.meeting_link}
                            target="_blank" rel="noreferrer"
                            className="btn btn-primary btn-sm cal-join-btn"
                            onClick={e => e.stopPropagation()}
                          >
                            <Video size={13} /> Join Meeting
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="cal-sidebar-empty">
                <CalIcon size={40} color="#e2e8f0" />
                <p>Click on a day to see meetings</p>
                <div className="cal-upcoming-label">Upcoming meetings</div>
                <div className="cal-upcoming-list">
                  {meetings
                    .filter(m => parseISO(m.start_time) >= new Date())
                    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
                    .slice(0, 5)
                    .map(m => (
                      <div key={m.id} className="cal-upcoming-item" onClick={() => setViewMeeting(m)}>
                        <div className="cui-date">{formatDate(m.start_time, 'MMM d')}</div>
                        <div className="cui-info">
                          <div className="cui-title">{m.title}</div>
                          <div className="cui-time">{formatTime(m.start_time)}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateMeetingModal
          onClose={() => setShowCreate(false)}
          onCreated={(m) => { setMeetings(prev => [...prev, m]); setShowCreate(false); toast.success('Meeting scheduled!'); }}
        />
      )}

      {viewMeeting && (
        <MeetingDetailModal
          meeting={viewMeeting}
          onClose={() => setViewMeeting(null)}
          onDeleted={() => { loadMeetings(); setViewMeeting(null); }}
        />
      )}
    </>
  );
}

function CreateMeetingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', description: '', start_time: '', end_time: '',
    location: '', meeting_link: '', attendees: []
  });
  const [saving, setSaving] = useState(false);
  const [stories, setStories] = useState([]);

  useEffect(() => {
    api.get('/stories?limit=100').then(r => setStories(r.data.stories || [])).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    if (!form.title || !form.start_time || !form.end_time) {
      toast.error('Title, start, and end time required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/meetings', form);
      onCreated(res.data.meeting);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title">Schedule Meeting</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className="form-control" placeholder="Meeting title" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start *</label>
                <input type="datetime-local" className="form-control" value={form.start_time}
                  onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">End *</label>
                <input type="datetime-local" className="form-control" value={form.end_time}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Location / Link</label>
              <input className="form-control" placeholder="Room or video link" value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Meeting Join URL</label>
              <input className="form-control" placeholder="https://teams.microsoft.com/..." value={form.meeting_link}
                onChange={e => setForm(p => ({ ...p, meeting_link: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Linked Story</label>
              <select className="form-control" value={form.user_story_id || ''}
                onChange={e => setForm(p => ({ ...p, user_story_id: e.target.value || null }))}>
                <option value="">None</option>
                {stories.map(s => (
                  <option key={s.id} value={s.id}>{s.title} {s.client_company ? `(${s.client_company})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={3} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : <Plus size={15} />}
              {saving ? 'Saving...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MeetingDetailModal({ meeting, onClose, onDeleted }) {
  const { isManager } = useAuth();

  const handleDelete = async () => {
    if (!window.confirm('Delete this meeting?')) return;
    try {
      await api.delete(`/meetings/${meeting.id}`);
      onDeleted();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">Meeting Details</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{meeting.title}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="meeting-detail-row">
              <Clock size={14} />
              <span>{formatDate(meeting.start_time, 'MMM d, yyyy h:mm a')} — {formatTime(meeting.end_time)}</span>
            </div>
            {meeting.location && (
              <div className="meeting-detail-row">
                <MapPin size={14} />
                <span>{meeting.location}</span>
              </div>
            )}
            {meeting.organizer_name && (
              <div className="meeting-detail-row">
                <CalIcon size={14} />
                <span>Organized by {meeting.organizer_name}</span>
              </div>
            )}
            {meeting.description && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{meeting.description}</p>
            )}
          </div>
        </div>
        <div className="modal-footer">
          {isManager() && (
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
          )}
          {(meeting.meeting_link || meeting.ms_teams_join_url) && (
            <a
              href={meeting.ms_teams_join_url || meeting.meeting_link}
              target="_blank" rel="noreferrer"
              className="btn btn-primary"
            >
              <Video size={15} /> Join Meeting
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
