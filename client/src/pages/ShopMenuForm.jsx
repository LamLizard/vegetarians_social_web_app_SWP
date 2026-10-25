// Một draft editor cho món menu; create chọn Dish, edit chỉ giữ phân loại đã lưu.
import { useEffect, useId, useRef, useState } from 'react';
import Button from '../components/Button/Button';
import Checkbox from '../components/Checkbox/Checkbox';
import ConfirmDialog from '../components/ConfirmDialog/ConfirmDialog';
import ImageUpload from '../components/ImageUpload/ImageUpload';
import Modal from '../components/Modal/Modal';
import Notice from '../components/Notice/Notice';
import Photo from '../components/Photo/Photo';
import TextField from '../components/TextField/TextField';
import shopMenuImageUploadService from '../services/shopMenuImageUpload.service';
import ShopMenuDishPicker from './ShopMenuDishPicker';
import styles from './ShopManagementPage.module.css';

const initialDraft = item => ({ displayName: item?.displayName || '', imageUrl: item?.customImageUrl || '',
  price: item ? String(item.price) : '', ingredientNote: item?.ingredientNote || '', isAvailable: item?.isAvailable ?? true });

export default function ShopMenuForm({ item, latestItem, busy, readOnly, failure, onClose, onSave, onRefresh, onClearFailure }) {
  const creating = !item;
  const nameId = useId();
  const baseline = useRef(initialDraft(item));
  const [draft, setDraft] = useState(() => initialDraft(item));
  const [dish, setDish] = useState(null);
  const [pickerDirty, setPickerDirty] = useState(false);
  const [localErrors, setLocalErrors] = useState({});
  const [discarding, setDiscarding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [failedUpload, setFailedUpload] = useState(null);
  const [imageRevision, setImageRevision] = useState(0);
  const [version, setVersion] = useState(item?.version);
  const [continued, setContinued] = useState(false);
  const [savingAction, setSavingAction] = useState(null);
  const flight = useRef(false);
  const uploadCount = useRef(0);
  const retryController = useRef(null);
  const alive = useRef(true);
  const versionConflict = !creating && failure?.status === 409 && failure.details?.code === 'SHOP_CONFLICT';
  const canCompare = latestItem && latestItem.version !== version;
  const dirtyFields = Object.keys(draft).filter(key => draft[key] !== baseline.current[key]);
  const dirty = Boolean(dirtyFields.length || failedUpload || creating && !continued && (dish || pickerDirty));
  const disabled = busy || readOnly || uploading;
  const errors = { ...failure?.details?.fieldErrors, ...localErrors };
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; retryController.current?.abort(); };
  }, []);
  useEffect(() => { if (continued) document.getElementById(nameId)?.focus(); }, [continued, nameId]);
  const change = (key, value) => {
    setDraft(current => ({ ...current, [key]: value })); setLocalErrors({}); setContinued(false);
    if (!versionConflict) onClearFailure?.();
  };
  const upload = async (file, options) => {
    uploadCount.current += 1; setUploading(true); setFailedUpload(null); setContinued(false);
    try { return await shopMenuImageUploadService.upload(file, options); }
    catch (error) {
      if (alive.current && !options?.signal?.aborted) setFailedUpload({ file, message: error.message });
      if (alive.current && error.status === 403) onRefresh?.();
      throw error;
    } finally {
      uploadCount.current -= 1;
      if (alive.current) setUploading(uploadCount.current > 0);
    }
  };
  const requestClose = () => {
    if (busy || flight.current || uploadCount.current) return;
    if (dirty) setDiscarding(true); else onClose();
  };
  const submit = async event => {
    event.preventDefault();
    if (busy || readOnly || flight.current || uploadCount.current || failedUpload || versionConflict) return;
    const nextErrors = {};
    const amount = /^\d+$/.test(draft.price) && Number(draft.price) <= 99999999 ? Number(draft.price) : null;
    if (creating && !dish?.selectable) nextErrors.dishId = 'Chọn phân loại đã được duyệt từ gợi ý.';
    if ((creating || dirtyFields.includes('displayName')) && (!draft.displayName.trim() || Array.from(draft.displayName.trim().normalize('NFC')).length > 100)) nextErrors.displayName = 'Nhập tên món từ 1 đến 100 ký tự.';
    if (amount === null) nextErrors.price = 'Nhập giá nguyên VNĐ từ 0 đến 99.999.999.';
    if (Array.from(draft.ingredientNote.trim()).length > 500) nextErrors.ingredientNote = 'Ghi chú tối đa 500 ký tự.';
    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const fields = { ...draft, displayName: draft.displayName.trim().normalize('NFC'), imageUrl: draft.imageUrl || null, price: amount, ingredientNote: draft.ingredientNote.trim() };
    let payload;
    const keepAdding = event.nativeEvent.submitter?.value === 'continue';
    if (creating) {
      payload = { ...fields, dishId: dish.dishId };
    } else {
      if (!dirtyFields.length) return;
      payload = { ...Object.fromEntries(dirtyFields.map(key => [key, fields[key]])), expectedVersion: version };
    }
    flight.current = true; setSavingAction(keepAdding ? 'continue' : 'close');
    try {
      const result = await onSave(payload, { keepAdding });
      if (!alive.current || !result) return;
      if (!creating || !keepAdding) { onClose(); return; }
      setDraft(initialDraft()); setLocalErrors({}); setContinued(true); setFailedUpload(null); setImageRevision(current => current + 1);
    } finally { flight.current = false; if (alive.current) setSavingAction(null); }
  };
  return <>
    <Modal open onClose={requestClose} title={creating ? 'Thêm món vào menu' : `Sửa món: ${item.effectiveName || item.dishName}`}
      size="lg" dismissible={!busy && !uploading}>
      <form className={styles.form} onSubmit={submit}>
        {creating ? <ShopMenuDishPicker value={dish} disabled={disabled} error={errors.dishId} onDirty={setPickerDirty}
          onChange={value => { setDish(value); setContinued(false); setLocalErrors({}); onClearFailure?.(); }} />
          : <p className={styles.classification}>Phân loại: <b>{item.dishName}</b></p>}
        <TextField id={nameId} label="Tên món của quán" value={draft.displayName} onChange={value => change('displayName', value)}
          required={creating || Boolean(item.displayName)} maxLength={100} disabled={disabled} error={errors.displayName}
          placeholder={creating ? 'Ví dụ: Bánh mì nấm xào chay' : item.dishName}
          hint={!creating && !item.displayName ? 'Món cũ đang dùng tên phân loại. Có thể giữ trống nếu chỉ sửa giá, ghi chú hoặc trạng thái.' : 'Tên này được hiển thị trên menu của quán.'} />
        {failedUpload ? <Notice tone="alert" title="Chưa tải được ảnh món">
          <p>{failedUpload.message}</p>
          <div className={styles.actions}>
            <Button variant="outline" disabled={disabled} onClick={async () => {
              retryController.current = new AbortController();
              try { const url = await upload(failedUpload.file, { signal: retryController.current.signal }); if (alive.current) change('imageUrl', url); }
              catch { /* Field giữ lỗi để thử lại hoặc bỏ lần tải. */ }
            }}>Thử lại</Button>
            <Button variant="subtle" disabled={disabled} onClick={() => { setFailedUpload(null); setImageRevision(current => current + 1); }}>Bỏ lần tải lỗi</Button>
          </div>
        </Notice> : <ImageUpload key={imageRevision} label="Ảnh món của quán" value={draft.imageUrl} onChange={url => change('imageUrl', url)}
          onUpload={upload} ratio="1/1" maxSizeMB={5} disabled={disabled} error={errors.imageUrl} className={styles.menuImageField}
          hint="JPG, PNG hoặc WEBP, tối đa 5 MB. Không có ảnh riêng sẽ dùng ảnh phân loại." />}
        {!creating && !draft.imageUrl && item.dishImageUrl && <div className={styles.menuImageFallback}>
          <Photo src={item.dishImageUrl} alt={`Ảnh phân loại ${item.dishName}`} ratio="1/1" /><span>Ảnh phân loại được dùng khi không có ảnh riêng.</span>
        </div>}
        <div className={styles.menuFormColumns}>
          <TextField label="Giá bán" value={draft.price} onChange={value => change('price', value)} inputMode="numeric" suffix="VNĐ" required disabled={disabled}
            hint="Nhập 0 nếu miễn phí." error={errors.price} />
          <Checkbox switch checked={draft.isAvailable} onChange={value => change('isAvailable', value)} disabled={disabled}>Đang bán</Checkbox>
        </div>
        <TextField label="Ghi chú thành phần" value={draft.ingredientNote} onChange={value => change('ingredientNote', value)}
          maxLength={500} disabled={disabled} hint="Không bắt buộc; có thể để trống." error={errors.ingredientNote} />
        {readOnly && <Notice>Quán hiện chỉ được xem. Dữ liệu bạn đang nhập được giữ để đối chiếu.</Notice>}
        {versionConflict ? <Notice tone="alert" title="Món đã thay đổi trong lúc bạn chỉnh sửa">
          {canCompare ? <><p>Bản đã lưu: {latestItem.effectiveName} · {latestItem.price === 0 ? 'Miễn phí' : `${latestItem.price.toLocaleString('vi-VN')} ₫`} · {latestItem.isAvailable ? 'Đang bán' : 'Tạm hết'}</p>
            <p>Ghi chú: {latestItem.ingredientNote || 'Không có'}</p>
            <div className={styles.menuImageFallback}><Photo src={latestItem.effectiveImageUrl} alt="Ảnh món đã lưu" ratio="1/1" /></div>
            <Button variant="outline" disabled={busy || readOnly} onClick={() => { setVersion(latestItem.version); onClearFailure?.(); }}>Giữ bản nhập và dùng phiên bản mới</Button>
          </> : <Button variant="outline" disabled={busy} onClick={onRefresh}>Tải bản mới để đối chiếu</Button>}
        </Notice> : failure && <Notice tone="alert">{failure.message}</Notice>}
        {continued && <Notice tone="success">Đã thêm món. Phân loại được giữ để bạn nhập món tiếp theo.</Notice>}
        <div className={styles.actions}>
          <Button variant="subtle" disabled={busy || uploading} onClick={requestClose}>Hủy</Button>
          <Button type="submit" value="close" className={styles.menuSubmit} loading={savingAction === 'close'} disabled={busy || readOnly || uploading || Boolean(failedUpload) || versionConflict || !creating && !dirtyFields.length}>
            {creating ? 'Thêm' : 'Lưu thay đổi'}
          </Button>
          {creating && <Button type="submit" value="continue" className={styles.menuContinue} variant="outline" disabled={busy || readOnly || uploading || Boolean(failedUpload)} loading={savingAction === 'continue'}>Thêm &amp; tiếp tục</Button>}
        </div>
      </form>
    </Modal>
    <ConfirmDialog open={discarding} title="Bỏ dữ liệu đang nhập?" confirmLabel="Bỏ và đóng" cancelLabel="Tiếp tục nhập"
      message="Các thay đổi chưa lưu sẽ được bỏ."
      onCancel={() => setDiscarding(false)} onConfirm={() => { setDiscarding(false); onClose(); }} />
  </>;
}
