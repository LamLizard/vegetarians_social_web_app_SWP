import { useEffect, useRef, useState } from 'react';
import {
  Avatar, Button, FormField, Modal, Photo, Tag, useToast,
} from '../../../components';
import cx from '../../../components/cx';
import { useApp, useCurrentUser } from '../../store/AppStore';
import { COVERS, DIETS } from '../../store/mockData';
import { readImageFile } from '../../utils/format';
import styles from './profile.module.css';

const BIO_MAX = 160;

/** Hộp thoại chỉnh sửa trang cá nhân của chính mình. */
export default function EditProfileModal({ open, onClose }) {
  const { actions } = useApp();
  const me = useCurrentUser();
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm({ fullName: me.fullName, bio: me.bio ?? '', city: me.city ?? '', diet: me.diet, cover: me.cover, avatar: me.avatar ?? null });
      setErrors({});
    }
  }, [open, me]);

  if (!form) return null;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const avatar = await readImageFile(file, 400);
      setForm((f) => ({ ...f, avatar }));
    } catch (err) {
      setErrors((x) => ({ ...x, avatar: err.message }));
    }
  };

  const save = () => {
    const next = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Họ tên cần ít nhất 2 ký tự.';
    if (form.bio.length > BIO_MAX) next.bio = `Giới thiệu tối đa ${BIO_MAX} ký tự.`;
    setErrors(next);
    if (Object.keys(next).length) return;
    actions.updateProfile({ ...form, fullName: form.fullName.trim(), bio: form.bio.trim(), city: form.city.trim() });
    toast('Đã cập nhật trang cá nhân');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Chỉnh sửa trang cá nhân"
      footer={(
        <>
          <Button variant="subtle" onClick={onClose}>Hủy</Button>
          <Button icon="check2" onClick={save}>Lưu thay đổi</Button>
        </>
      )}
    >
      <div className={styles.editSection}>
        <div className={styles.editLabel}>Ảnh đại diện</div>
        <div className="d-flex align-items-center gap-3">
          <Avatar name={form.fullName} src={form.avatar} size={72} />
          <div className="d-flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon="camera" onClick={() => fileRef.current?.click()}>Tải ảnh lên</Button>
            {form.avatar && <Button size="sm" variant="subtle" onClick={() => setForm((f) => ({ ...f, avatar: null }))}>Gỡ ảnh</Button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickAvatar} />
        </div>
        {errors.avatar && <div className="invalid-feedback d-block">{errors.avatar}</div>}
      </div>

      <div className={styles.editSection}>
        <div className={styles.editLabel}>Ảnh bìa</div>
        <div className={styles.coverPicker} role="radiogroup" aria-label="Chọn ảnh bìa">
          {COVERS.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={form.cover === c}
              aria-label={`Ảnh bìa ${i + 1}`}
              className={cx(styles.coverOption, form.cover === c && styles.coverOn)}
              onClick={() => setForm((f) => ({ ...f, cover: c }))}
            >
              <Photo src={c.replace('w=1600', 'w=300')} />
              {form.cover === c && <i className="bi bi-check-circle-fill" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Họ và tên" required value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
      <FormField
        label="Giới thiệu"
        multiline
        placeholder="Vài dòng về hành trình ăn chay của bạn…"
        value={form.bio}
        onChange={set('bio')}
        error={errors.bio}
        hint={`${form.bio.length}/${BIO_MAX} ký tự`}
      />
      <FormField label="Sống tại" placeholder="Vd: TP. Hồ Chí Minh" value={form.city} onChange={set('city')} />

      <fieldset>
        <legend className="form-label fw-semibold small mb-1">Chế độ ăn</legend>
        <div className="d-flex flex-wrap gap-2">
          {Object.entries(DIETS).map(([key, d]) => (
            <Tag key={key} icon={d.icon} active={form.diet === key} onClick={() => setForm((f) => ({ ...f, diet: key }))}>{d.label}</Tag>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}
