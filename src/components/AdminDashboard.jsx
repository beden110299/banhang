import React, { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { formatDateTime } from '../utils/format';
import { ORDER_STATUS_OPTIONS, getOrderStatusLabel, getOrderStatusBadgeClass } from '../utils/orderStatus';
import { getProductsNearPrice } from '../utils/productsByAmount';

const DEFAULT_CATEGORIES = ['Mỹ Phẩm 10%', 'Điện Tử 20%', 'Điện Lạnh 30%', 'VIP 50%'];

const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: 'Son Môi Aura Premium Velvet',
    category: 'Mỹ Phẩm 10%',
    price: 1200000,
    desc: 'Son môi siêu mịn lì vỏ mạ vàng tinh tế, giữ màu lâu trôi, chiết xuất dưỡng chất tự nhiên.',
    icon: '💄'
  },
  {
    id: 2,
    name: 'Serum Dưỡng Da Aura Collagen Gold',
    category: 'Mỹ Phẩm 10%',
    price: 2400000,
    desc: 'Tinh chất dưỡng trắng ngọc trai, phục hồi tế bào gốc và nâng cơ trẻ hóa da hiệu quả.',
    icon: '🧴'
  },
  {
    id: 3,
    name: 'SoundAura Premium ANC Headphones',
    category: 'Điện Tử 20%',
    price: 6200000,
    desc: 'Tai nghe chống ồn chủ động cao cấp, chất lượng âm thanh studio chân thực, pin 40 giờ liên tục.',
    icon: '🎧'
  },
  {
    id: 4,
    name: 'Ocular Horizon Smart Specs',
    category: 'Điện Tử 20%',
    price: 12500000,
    desc: 'Kính thực tế ảo tăng cường micro-OLED thông minh hiển thị dữ liệu thời gian thực đỉnh cao.',
    icon: '🕶️'
  },
  {
    id: 5,
    name: 'Tủ Lạnh Aura Inverter Mirror Door',
    category: 'Điện Lạnh 30%',
    price: 34500000,
    desc: 'Tủ lạnh mặt kính gương đen sang trọng, công suất inverter tiết kiệm điện 5 sao, kháng khuẩn nano.',
    icon: '❄️'
  },
  {
    id: 6,
    name: 'Điều Hòa Không Khí Aura WindFree',
    category: 'Điện Lạnh 30%',
    price: 18900000,
    desc: 'Điều hòa lọc bụi mịn siêu vi, làm lạnh êm dịu không gió buốt, điều khiển từ xa qua smartphone.',
    icon: '💨'
  },
  {
    id: 7,
    name: 'Royal Oak Chronograph Gold Edition',
    category: 'VIP 50%',
    price: 425000000,
    desc: 'Siêu phẩm đồng hồ chế tác giới hạn, vỏ vàng nguyên khối 18K, tuyệt tác nghệ thuật Haute Horlogerie.',
    icon: '👑'
  },
  {
    id: 8,
    name: 'Aura VIP Privilege Membership Card',
    category: 'VIP 50%',
    price: 50000000,
    desc: 'Thẻ thành viên VIP độc quyền Aura Store, đặc quyền hưởng ưu đãi giảm giá 30% và chăm sóc đặc biệt.',
    icon: '💳'
  }
];

export default function AdminDashboard({ storeName, onStoreNameChange, addToast }) {
  // Core lists
  const [usersList, setUsersList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [bannersList, setBannersList] = useState([]);
  const [sponsorCode, setSponsorCode] = useState('CTV123');
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSavingBanners, setIsSavingBanners] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  // Form states for Banners
  const [newBannerTitle, setNewBannerTitle] = useState('');
  const [newBannerSubtitle, setNewBannerSubtitle] = useState('');
  const [newBannerImage, setNewBannerImage] = useState('');

  // Refs for tracking updates and avoiding stale closures
  const usersRef = useRef([]);
  const ordersRef = useRef([]);
  const txsRef = useRef([]);
  const isLoadedRef = useRef(false);

  // Sync refs when states change
  useEffect(() => {
    usersRef.current = usersList;
  }, [usersList]);

  // Synthesize notification bell chime sound using native Web Audio API
  const playChimeSound = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playNote = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        // Add harmonic frequency for warmth and realism
        const osc2 = ctx.createOscillator();
        const gainNode2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.15, startTime + 0.02); // linear attack
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration); // exponential decay
        
        gainNode2.gain.setValueAtTime(0, startTime);
        gainNode2.gain.linearRampToValueAtTime(0.05, startTime + 0.01);
        gainNode2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.5);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc2.connect(gainNode2);
        gainNode2.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
        
        osc2.start(startTime);
        osc2.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      // High-quality double chime (C6 at 1046.50Hz, then E6 at 1318.51Hz after 120ms)
      playNote(1046.50, now, 0.6);
      playNote(1318.51, now + 0.12, 0.8);
    } catch (err) {
      console.error('Failed to play synthesized chime sound:', err);
    }
  };

  // Navigation
  const [activeTab, setActiveTab] = useState('overview');
  const [loadedTabs, setLoadedTabs] = useState({
    overview: false,
    members: false,
    categories: false,
    products: false,
    orders: false,
    transactions: false
  });

  const [ordersList, setOrdersList] = useState([]);
  const [transactionsList, setTransactionsList] = useState([]);

  useEffect(() => {
    ordersRef.current = ordersList;
  }, [ordersList]);

  useEffect(() => {
    txsRef.current = transactionsList;
  }, [transactionsList]);
  const [searchOrder, setSearchOrder] = useState('');
  const [searchTransaction, setSearchTransaction] = useState('');
  const [pushOrderModal, setPushOrderModal] = useState(false);
  const [orderEditModal, setOrderEditModal] = useState({ isOpen: false, order: null });
  const [pushOrderForm, setPushOrderForm] = useState({
    phone: '',
    items: [{ amount: '', productId: '', quantity: 1 }],
  });
  const [orderEditForm, setOrderEditForm] = useState({ status: 'shipping', statusNote: '', note: '' });

  // Settings
  const [newSponsorCode, setNewSponsorCode] = useState('');
  const [newStoreName, setNewStoreName] = useState(storeName || 'Miinto');
  const [cskhType, setCskhType] = useState('built_in');
  const [cskhScript, setCskhScript] = useState('');
  const [isSavingCSKH, setIsSavingCSKH] = useState(false);

  // Modals visibility
  const [memberModal, setMemberModal] = useState({ isOpen: false, type: 'add', data: null });
  const [categoryModal, setCategoryModal] = useState({ isOpen: false, type: 'add', data: null });
  const [productModal, setProductModal] = useState({ isOpen: false, type: 'add', data: null });
  const [permissionsModal, setPermissionsModal] = useState({ isOpen: false, user: null });
  const [allowedCatsForm, setAllowedCatsForm] = useState([]);

  // Modal input states
  const [memberForm, setMemberForm] = useState({ name: '', phone: '', password: '', role: 'user', balance: '0' });
  const [adminDepositAmount, setAdminDepositAmount] = useState('');
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', percent: 10, originalName: '', icon: '' });
  const [productForm, setProductForm] = useState({ id: null, name: '', category: '', price: '', desc: '', icon: '📦' });

  // Search filters
  const [searchUser, setSearchUser] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedAdminProductCategory, setSelectedAdminProductCategory] = useState('Tất cả');

  // Pagination states
  const [userPage, setUserPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [txPage, setTxPage] = useState(1);

  // Reset pagination when search query or activeTab changes
  useEffect(() => {
    setUserPage(1);
  }, [searchUser]);

  useEffect(() => {
    setOrderPage(1);
  }, [searchOrder]);

  useEffect(() => {
    setTxPage(1);
  }, [searchTransaction]);

  // Lazy load tab data when tab changes (Cost-saving & zero Vercel overhead)
  const loadTabSpecificData = async (tabName, force = false) => {
    if (!force && loadedTabs[tabName]) return;
    try {
      if (tabName === 'overview') {
        const [code, name, banners, cskh] = await Promise.all([
          api.getSponsorCode(),
          api.getStoreName(),
          api.getBanners().catch(() => []),
          api.getCSKHSettings().catch(() => ({ cskh_type: 'built_in', cskh_script: '' }))
        ]);
        setSponsorCode(code);
        setNewSponsorCode(code);
        setNewStoreName(name);
        onStoreNameChange?.(name);
        setBannersList(banners);
        setCskhType(cskh.cskh_type || 'built_in');
        setCskhScript(cskh.cskh_script || '');
      } else if (tabName === 'members') {
        const users = await api.getMembers();
        setUsersList(users);
        try {
          const pending = await api.getPendingWithdrawals();
          setPendingWithdrawals(pending);
        } catch {
          setPendingWithdrawals([]);
        }
      } else if (tabName === 'categories') {
        const cats = await api.getCategories();
        setCategoriesList(cats);
      } else if (tabName === 'products') {
        const [cats, prods] = await Promise.all([
          api.getCategories().catch(() => []),
          api.getProducts().catch(() => [])
        ]);
        setCategoriesList(cats);
        setProductsList(prods);
      } else if (tabName === 'orders') {
        const [orders, users, prods] = await Promise.all([
          api.getAdminOrders().catch(() => []),
          api.getMembers().catch(() => []),
          api.getProducts().catch(() => [])
        ]);
        setOrdersList(orders);
        setUsersList(users);
        setProductsList(prods);
      } else if (tabName === 'transactions') {
        const [txs, pending] = await Promise.all([
          api.getAdminTransactions().catch(() => []),
          api.getPendingWithdrawals().catch(() => [])
        ]);
        setTransactionsList(txs);
        setPendingWithdrawals(pending);
      }
      setLoadedTabs(prev => ({ ...prev, [tabName]: true }));
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu cho tab: " + tabName, err);
      addToast('danger', 'Lỗi tải dữ liệu', `Không thể tải dữ liệu cho tab ${tabName}. Vui lòng thử lại.`);
    }
  };

  // Watch for activeTab switches to trigger lazy loading
  useEffect(() => {
    setUserPage(1);
    setOrderPage(1);
    setTxPage(1);
    if (isLoadedRef.current && !loadedTabs[activeTab]) {
      loadTabSpecificData(activeTab);
    }
  }, [activeTab]);

  // Initial mount load (Only load system configurations and Overview tab data)
  useEffect(() => {
    const initDashboard = async () => {
      try {
        await loadTabSpecificData('overview', true);
        isLoadedRef.current = true;
      } catch (err) {
        addToast('danger', 'Lỗi kết nối', 'Không thể nạp dữ liệu cấu hình hệ thống từ Neon DB.');
      }
    };
    initDashboard();
  }, []);

  // Background polling interval to fetch updates for orders, transactions and withdrawals in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLoadedRef.current) {
        handleRefreshSystemData(true);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // On-demand system refresh function (cost-saving)
  const handleRefreshSystemData = async (silent = false) => {
    if (!isLoadedRef.current) return;
    setIsRefreshing(true);
    try {
      // 1. Fetch core watched items for Toast & Chime notifications
      const [users, orders, txs] = await Promise.all([
        api.getMembers().catch(() => []),
        api.getAdminOrders().catch(() => []),
        api.getAdminTransactions().catch(() => []),
      ]);

      // 2. Fetch specific data based on the current active tab to ensure UI is fresh
      if (activeTab === 'categories') {
        const cats = await api.getCategories().catch(() => []);
        setCategoriesList(cats);
      } else if (activeTab === 'products') {
        const [cats, prods] = await Promise.all([
          api.getCategories().catch(() => []),
          api.getProducts().catch(() => [])
        ]);
        setCategoriesList(cats);
        setProductsList(prods);
      } else if (activeTab === 'overview') {
        const [code, name, banners, cskh] = await Promise.all([
          api.getSponsorCode().catch(() => 'CTV123'),
          api.getStoreName().catch(() => 'Miinto'),
          api.getBanners().catch(() => []),
          api.getCSKHSettings().catch(() => ({ cskh_type: 'built_in', cskh_script: '' }))
        ]);
        setSponsorCode(code);
        setNewSponsorCode(code);
        setNewStoreName(name);
        onStoreNameChange?.(name);
        setBannersList(banners);
        setCskhType(cskh.cskh_type || 'built_in');
        setCskhScript(cskh.cskh_script || '');
      } else if (activeTab === 'members' || activeTab === 'transactions') {
        try {
          const pending = await api.getPendingWithdrawals();
          setPendingWithdrawals(pending);
        } catch {
          setPendingWithdrawals([]);
        }
      }

      let playSound = false;

      // 3. Detect new members
      const existingPhones = new Set(usersRef.current.map((u) => u.phone));
      const newUsers = users.filter((u) => !existingPhones.has(u.phone));
      if (newUsers.length > 0) {
        newUsers.forEach((u) => {
          addToast('success', '👤 Thành viên mới', `Thành viên ${u.name} (${u.phone}) vừa đăng ký tài khoản.`);
        });
        playSound = true;
      }
      setUsersList(users);

      // 4. Detect new orders
      const existingOrderIds = new Set(ordersRef.current.map((o) => o.id));
      const newOrders = orders.filter((o) => !existingOrderIds.has(o.id));
      if (newOrders.length > 0) {
        newOrders.forEach((o) => {
          addToast('success', '📦 Đơn hàng mới', `Đơn hàng ${o.order_code} từ khách hàng ${o.user_name || o.phone} vừa được tạo.`);
        });
        playSound = true;
      }
      setOrdersList(orders);

      // 5. Detect new wallet transactions
      const existingTxIds = new Set(txsRef.current.map((t) => t.id));
      const newTxs = txs.filter((t) => !existingTxIds.has(t.id));
      if (newTxs.length > 0) {
        newTxs.forEach((t) => {
          addToast('success', '💳 Giao dịch mới', `${formatTxType(t.type)}: Khách hàng ${t.user_name || t.phone} vừa tạo giao dịch số tiền ${t.amount.toLocaleString('vi-VN')}đ.`);
        });
        playSound = true;
      }
      setTransactionsList(txs);

      // Play notification chime sound if anything new arrived and not silent
      if (playSound && !silent) {
        playChimeSound();
      }

      if (!silent && !playSound) {
        addToast('success', 'Đã làm mới', 'Dữ liệu hệ thống đã được cập nhật mới nhất.');
      }
    } catch (err) {
      console.error('Lỗi khi làm mới dữ liệu hệ thống:', err);
      if (!silent) {
        addToast('danger', 'Lỗi làm mới', 'Không thể tải dữ liệu cập nhật từ máy chủ.');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWipeSystemData = async () => {
    const confirm1 = window.confirm(
      '⚠️ CẢNH BÁO NGUY HIỂM:\nHành động này sẽ XÓA TOÀN BỘ lịch sử nạp rút tiền, yêu cầu rút tiền và tất cả đơn mua hàng trên toàn hệ thống.\nĐồng thời số dư ví của toàn bộ thành viên sẽ được ĐẶT LẠI VỀ 0.\n\nBạn có thực sự chắc chắn muốn xóa không?'
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      '❗ XÁC NHẬN LẦN CUỐI:\nDữ liệu sau khi xóa SẼ KHÔNG THỂ KHÔI PHỤC.\nBạn có chắc chắn muốn thực hiện thao tác xóa dữ liệu hệ thống?'
    );
    if (!confirm2) return;

    setIsWiping(true);
    try {
      const result = await api.resetSystemData();
      addToast('success', 'Thành công', result.message || 'Đã xóa sạch dữ liệu nạp rút và đơn hàng.');
      handleRefreshSystemData(true);
    } catch (err) {
      addToast('danger', 'Lỗi xóa dữ liệu', err.message || 'Không thể xóa dữ liệu hệ thống.');
    } finally {
      setIsWiping(false);
    }
  };

  // -------------------------------------------------------------
  // SPONSOR CODE HANDLERS
  // -------------------------------------------------------------
  useEffect(() => {
    setNewStoreName(storeName);
  }, [storeName]);

  const handleUpdateStoreName = async (e) => {
    e.preventDefault();
    if (!newStoreName.trim()) {
      addToast('danger', 'Lỗi nhập liệu', 'Tên cửa hàng không được để trống');
      return;
    }
    try {
      const result = await api.updateStoreName(newStoreName.trim());
      onStoreNameChange?.(result.storeName || newStoreName.trim());
      addToast('success', 'Thành công', `Đã đổi tên cửa hàng thành: ${result.storeName || newStoreName.trim()}`);
    } catch (err) {
      addToast('danger', 'Lỗi cấu hình', err.message);
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('danger', 'Tệp không hợp lệ', 'Vui lòng chỉ tải lên tệp hình ảnh.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast('danger', 'Tệp quá lớn', 'Kích thước ảnh tối đa là 10MB.');
      return;
    }

    setIsUploading(true);
    addToast('info', 'Đang tải lên', 'Hình ảnh banner đang được tải lên...');

    try {
      const response = await api.uploadImage(file, 'banners');
      if (response.success && response.url) {
        setNewBannerImage(response.url);
        addToast('success', 'Thành công', 'Đã tải ảnh banner lên thành công!');
      } else {
        throw new Error('Không nhận được URL hình ảnh từ máy chủ.');
      }
    } catch (err) {
      addToast('danger', 'Lỗi tải ảnh', err.message || 'Đã xảy ra lỗi khi tải ảnh lên.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddBanner = (e) => {
    e.preventDefault();
    if (!newBannerImage.trim()) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng cung cấp URL hoặc tải lên ảnh banner.');
      return;
    }
    const title = newBannerTitle.trim() || 'Chào mừng đến Miinto';
    const subtitle = newBannerSubtitle.trim() || 'Mua sắm trực tuyến chất lượng';
    const newBanner = {
      id: Date.now(),
      imageUrl: newBannerImage.trim(),
      title,
      subtitle
    };
    setBannersList(prev => [...prev, newBanner]);
    setNewBannerTitle('');
    setNewBannerSubtitle('');
    setNewBannerImage('');
    addToast('success', 'Đã thêm', 'Đã thêm slide banner mới vào danh sách tạm thời. Bấm Lưu ở bảng banner để lưu lại cấu hình.');
  };

  const handleDeleteBanner = (id) => {
    setBannersList(prev => prev.filter(b => b.id !== id));
    addToast('success', 'Đã xoá', 'Đã xoá slide banner khỏi danh sách tạm thời. Bấm Lưu ở bảng banner để lưu lại cấu hình.');
  };

  const handleSaveBanners = async () => {
    if (bannersList.length === 0) {
      addToast('danger', 'Lỗi lưu', 'Danh sách slide banner không được trống.');
      return;
    }
    setIsSavingBanners(true);
    try {
      const res = await api.updateBanners(bannersList);
      if (res.success) {
        addToast('success', 'Thành công', 'Đã lưu cấu hình slide banner thành công toàn hệ thống!');
      } else {
        throw new Error('Không thể lưu cấu hình.');
      }
    } catch (err) {
      addToast('danger', 'Lỗi lưu', err.message || 'Không thể kết nối máy chủ để lưu cấu hình.');
    } finally {
      setIsSavingBanners(false);
    }
  };

  const handleUpdateSponsorCode = async (e) => {
    e.preventDefault();
    if (!newSponsorCode.trim()) {
      addToast('danger', 'Lỗi cấu hình', 'Mã bảo lãnh không được để trống');
      return;
    }
    try {
      await api.updateSponsorCode(newSponsorCode.trim());
      setSponsorCode(newSponsorCode.trim());
      if (api.isFallback) {
        addToast('success', 'Thành công', `Cấu hình mã bảo lãnh mới: ${newSponsorCode.trim()} (Offline)`);
      } else {
        addToast('success', 'Thành công', `Cấu hình mã bảo lãnh mới: ${newSponsorCode.trim()} (Neon DB)`);
      }
    } catch (err) {
      addToast('danger', 'Lỗi cấu hình', err.message);
    }
  };

  const handleUpdateCSKHSettings = async (e) => {
    e.preventDefault();
    if (!cskhType) {
      addToast('danger', 'Lỗi cấu hình', 'Vui lòng chọn loại kênh CSKH');
      return;
    }
    setIsSavingCSKH(true);
    try {
      await api.updateCSKHSettings({ cskh_type: cskhType, cskh_script: cskhScript });
      addToast('success', 'Thành công', 'Đã lưu cấu hình kênh chat CSKH thành công.');
    } catch (err) {
      addToast('danger', 'Lỗi cấu hình', err.message || 'Không thể lưu cấu hình CSKH.');
    } finally {
      setIsSavingCSKH(false);
    }
  };

  // -------------------------------------------------------------
  // MEMBER CRUD ACTIONS
  // -------------------------------------------------------------
  const openMemberModal = (type, data = null) => {
    if (type === 'edit' && data) {
      setMemberForm({
        name: data.name,
        phone: data.phone,
        password: data.password || '',
        role: data.role,
        balance: String(data.balance ?? 0),
      });
      setAdminDepositAmount('');
    } else {
      setMemberForm({ name: '', phone: '', password: '', role: 'user', balance: '0' });
      setAdminDepositAmount('');
    }
    setMemberModal({ isOpen: true, type, data });
  };

  const closeMemberModal = () => {
    setMemberModal({ isOpen: false, type: 'add', data: null });
  };

  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    const { name, phone, password, role } = memberForm;

    if (!name.trim()) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập tên thành viên');
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập số điện thoại hợp lệ');
      return;
    }

    try {
      if (memberModal.type === 'add') {
        if (!password || password.length < 6) {
          addToast('danger', 'Lỗi nhập liệu', 'Mật khẩu tối thiểu phải 6 ký tự');
          return;
        }
        const newUser = { name: name.trim(), phone: phone.trim(), password, role };
        await api.addMember(newUser);
        addToast('success', 'Thành công', `Đã thêm thành viên ${name}`);
      } else {
        // Edit mode
        const originalPhone = memberModal.data.phone;
        const updatedUser = {
          name: name.trim(),
          phone: phone.trim(),
          role,
          balance: Math.max(0, Math.floor(Number(memberForm.balance)) || 0),
        };
        if (password) {
          updatedUser.password = password;
        }
        await api.updateMember(originalPhone, updatedUser);
        addToast('success', 'Thành công', `Cập nhật thành viên ${name}`);
      }

      await refreshMembersAndWallet();
      closeMemberModal();
    } catch (err) {
      addToast('danger', 'Lỗi thao tác', err.message);
    }
  };

  const refreshMembersAndWallet = async () => {
    const users = await api.getMembers();
    setUsersList(users);
    try {
      const pending = await api.getPendingWithdrawals();
      setPendingWithdrawals(pending);
    } catch {
      setPendingWithdrawals([]);
    }
  };

  const handleAdminDeposit = async () => {
    if (memberModal.type !== 'edit' || !memberModal.data?.phone) return;
    const amount = Math.floor(Number(adminDepositAmount));
    if (!amount || amount < 1000) {
      addToast('danger', 'Số tiền', 'Nhập số tiền nạp tối thiểu 1.000đ.');
      return;
    }
    try {
      await api.adminDeposit(memberModal.data.phone, amount, 'Nạp tiền — Admin xác nhận qua CSKH');
      addToast('success', 'Nạp tiền', `Đã nạp ${amount.toLocaleString('vi-VN')}đ vào ví thành viên.`);
      setAdminDepositAmount('');
      const updated = await api.getWallet(memberModal.data.phone);
      setMemberForm((f) => ({ ...f, balance: String(updated.balance) }));
      await refreshMembersAndWallet();
      await refreshTransactions();
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const handleApproveWithdraw = async (id) => {
    try {
      await api.approveWithdraw(id);
      addToast('success', 'Duyệt rút', 'Đã duyệt yêu cầu rút tiền.');
      await refreshMembersAndWallet();
      await refreshTransactions();
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const handleRejectWithdraw = async (id) => {
    try {
      await api.rejectWithdraw(id);
      addToast('success', 'Từ chối', 'Đã từ chối yêu cầu rút tiền.');
      await refreshMembersAndWallet();
      await refreshTransactions();
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const handleMemberDelete = async (userPhone, userName) => {
    if (userPhone === '0999999999') {
      addToast('danger', 'Lỗi bảo mật', 'Không được phép xóa tài khoản quản trị hệ thống');
      return;
    }
    if (window.confirm(`Bạn có chắc chắn muốn xóa thành viên ${userName}?`)) {
      try {
        await api.deleteMember(userPhone);
        const users = await api.getMembers();
        setUsersList(users);
        addToast('success', 'Đã xóa', `Đã xóa thành viên ${userName} khỏi hệ thống`);
      } catch (err) {
        addToast('danger', 'Lỗi xóa', err.message);
      }
    }
  };

  const handleToggleFreeze = async (user) => {
    if (user.phone === '0999999999') {
      addToast('danger', 'Bảo mật', 'Không thể đóng băng tài khoản quản trị hệ thống.');
      return;
    }
    const newStatus = !user.is_frozen;
    try {
      await api.updateMember(user.phone, { is_frozen: newStatus });
      addToast(
        'success',
        newStatus ? 'Đã đóng băng' : 'Đã mở băng',
        `Tài khoản ${user.name} đã được ${newStatus ? 'đóng băng giao dịch' : 'mở khóa hoạt động bình thường'}.`
      );
      await refreshMembersAndWallet();
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const openPermissionsModal = (user) => {
    if (user.phone === '0999999999') {
      addToast('danger', 'Bảo mật', 'Không cần phân quyền cho tài khoản quản trị.');
      return;
    }
    const userCats = user.allowed_categories 
      ? user.allowed_categories.split(',').map(s => s.trim())
      : [];
    setAllowedCatsForm(userCats);
    setPermissionsModal({ isOpen: true, user });
  };

  const handlePermissionsSubmit = async (e) => {
    e.preventDefault();
    const { user } = permissionsModal;
    if (!user) return;
    
    const availableCats = categoriesList.length > 0 ? categoriesList.map(c => c.name) : DEFAULT_CATEGORIES;
    const orderedSelections = availableCats.filter(catName => allowedCatsForm.includes(catName));
    const joinedString = orderedSelections.join(', ');
    
    try {
      await api.updateMember(user.phone, { allowed_categories: joinedString });
      addToast('success', 'Phân quyền', `Cập nhật quyền thành công cho thành viên ${user.name}.`);
      await refreshMembersAndWallet();
      setPermissionsModal({ isOpen: false, user: null });
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const toggleCategorySelection = (catName) => {
    setAllowedCatsForm(prev => 
      prev.includes(catName) 
        ? prev.filter(c => c !== catName) 
        : [...prev, catName]
    );
  };

  // -------------------------------------------------------------
  // CATEGORY CRUD ACTIONS
  // -------------------------------------------------------------
  const parseCategoryNameAndPercent = (fullName) => {
    if (!fullName) return { name: '', percent: 0 };
    // Matches "Name [Number]%" at the end of the string
    const match = fullName.match(/^(.*?)(?:\s+(\d+)%)?$/);
    if (match) {
      return {
        name: match[1].trim(),
        percent: match[2] ? parseInt(match[2], 10) : 0
      };
    }
    return { name: fullName, percent: 0 };
  };

  const openCategoryModal = (type, data = null) => {
    if (type === 'edit' && data) {
      const catName = typeof data === 'string' ? data : data.name;
      const parsed = parseCategoryNameAndPercent(catName);
      setCategoryForm({
        name: parsed.name,
        percent: parsed.percent,
        originalName: catName,
        icon: typeof data === 'string' ? '' : data.icon || '',
      });
    } else {
      setCategoryForm({ name: '', percent: 10, originalName: '', icon: '' });
    }
    setCategoryModal({ isOpen: true, type, data });
  };

  const closeCategoryModal = () => {
    setCategoryModal({ isOpen: false, type: 'add', data: null });
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    const { name, percent, originalName, icon } = categoryForm;

    if (!name.trim()) {
      addToast('danger', 'Lỗi nhập liệu', 'Vui lòng nhập tên danh mục');
      return;
    }

    const percentageVal = parseInt(percent, 10);
    if (isNaN(percentageVal) || percentageVal < 0 || percentageVal > 100) {
      addToast('danger', 'Lỗi nhập liệu', 'Phần trăm chiết khấu phải là số từ 0 đến 100');
      return;
    }

    const fullName = `${name.trim()} ${percentageVal}%`;

    try {
      if (categoryModal.type === 'add') {
        await api.addCategory(fullName, icon);
        addToast('success', 'Thành công', `Đã tạo danh mục mới: ${fullName}`);
      } else {
        await api.updateCategory(fullName, originalName, icon);
        addToast('success', 'Thành công', `Đã cập nhật danh mục ${fullName}`);
      }

      // Refresh lists
      const cats = await api.getCategories();
      setCategoriesList(cats);
      const prods = await api.getProducts();
      setProductsList(prods);
      closeCategoryModal();
    } catch (err) {
      addToast('danger', 'Lỗi thao tác', err.message);
    }
  };

  const handleCategoryImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast('danger', 'Tệp không hợp lệ', 'Vui lòng chỉ tải lên tệp hình ảnh.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast('danger', 'Tệp quá lớn', 'Kích thước ảnh tối đa là 10MB.');
      return;
    }

    setIsUploading(true);
    addToast('info', 'Đang tải lên', 'Ảnh danh mục đang được tải lên R2...');

    try {
      const response = await api.uploadImage(file, 'categories');
      if (response.success && response.url) {
        setCategoryForm((prev) => ({ ...prev, icon: response.url }));
        addToast(
          'success',
          'Thành công',
          response.message || 'Đã tải ảnh danh mục lên Cloudflare R2!'
        );
      } else {
        throw new Error('Không nhận được URL hình ảnh từ máy chủ.');
      }
    } catch (err) {
      addToast('danger', 'Lỗi tải ảnh', err.message || 'Đã xảy ra lỗi khi tải ảnh lên.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCategoryDelete = async (catName) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa danh mục '${catName}'?`)) {
      try {
        await api.deleteCategory(catName);
        const cats = await api.getCategories();
        setCategoriesList(cats);
        addToast('success', 'Đã xóa', `Đã xóa danh mục '${catName}'`);
      } catch (err) {
        addToast('danger', 'Lỗi xóa', err.message);
      }
    }
  };

  // -------------------------------------------------------------
  // PRODUCT CRUD ACTIONS
  // -------------------------------------------------------------
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast('danger', 'Tệp không hợp lệ', 'Vui lòng chỉ tải lên tệp hình ảnh.');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      addToast('danger', 'Tệp quá lớn', 'Kích thước ảnh tối đa là 10MB.');
      return;
    }

    setIsUploading(true);
    addToast('info', 'Đang tải lên', 'Hình ảnh đang được tải lên hệ thống...');

    try {
      const response = await api.uploadImage(file);
      if (response.success && response.url) {
        setProductForm(prev => ({ ...prev, icon: response.url }));
        if (response.message) {
          addToast('success', 'Thành công', response.message);
        } else {
          addToast('success', 'Thành công', 'Đã tải ảnh lên Cloudflare thành công!');
        }
      } else {
        throw new Error('Không nhận được URL hình ảnh từ máy chủ.');
      }
    } catch (err) {
      addToast('danger', 'Lỗi tải ảnh', err.message || 'Đã xảy ra lỗi khi tải ảnh lên.');
    } finally {
      setIsUploading(false);
    }
  };

  const openProductModal = (type, data = null) => {
    if (type === 'edit' && data) {
      setProductForm({
        id: data.id,
        name: data.name,
        category: data.category,
        price: data.price.toString(),
        desc: data.desc,
        icon: data.icon || '📦'
      });
    } else {
      setProductForm({
        id: null,
        name: '',
        category: categoriesList[0]?.name || '',
        price: '',
        desc: '',
        icon: '📦'
      });
    }
    setProductModal({ isOpen: true, type, data });
  };

  const closeProductModal = () => {
    setProductModal({ isOpen: false, type: 'add', data: null });
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const { id, name, category, price, desc, icon } = productForm;

    if (!name.trim()) {
      addToast('danger', 'Nhập liệu', 'Vui lòng nhập tên sản phẩm');
      return;
    }
    if (!category) {
      addToast('danger', 'Nhập liệu', 'Vui lòng chọn danh mục cho sản phẩm');
      return;
    }
    if (!price || isNaN(price) || Number(price) <= 0) {
      addToast('danger', 'Nhập liệu', 'Giá sản phẩm phải là số lớn hơn 0');
      return;
    }

    try {
      const prodData = {
        name: name.trim(),
        category,
        price: Number(price),
        desc: desc.trim(),
        icon: icon.trim() || '📦'
      };

      if (productModal.type === 'add') {
        await api.addProduct(prodData);
        addToast('success', 'Thành công', `Đã thêm sản phẩm mới: ${name}`);
      } else {
        await api.updateProduct(id, prodData);
        addToast('success', 'Thành công', `Cập nhật thông tin sản phẩm: ${name}`);
      }

      // Refresh product shelf
      const prods = await api.getProducts();
      setProductsList(prods);
      closeProductModal();
    } catch (err) {
      addToast('danger', 'Lỗi thao tác', err.message);
    }
  };

  const handleProductDelete = async (prodId, prodName) => {
    if (window.confirm(`Bạn có thực sự muốn xóa sản phẩm '${prodName}'?`)) {
      try {
        await api.deleteProduct(prodId);
        const prods = await api.getProducts();
        setProductsList(prods);
        addToast('success', 'Đã xóa', `Đã xóa sản phẩm '${prodName}' khỏi kệ hàng`);
      } catch (err) {
        addToast('danger', 'Lỗi xóa', err.message);
      }
    }
  };

  const refreshOrders = async () => {
    const orders = await api.getAdminOrders();
    setOrdersList(orders);
  };

  const refreshTransactions = async () => {
    const txs = await api.getAdminTransactions();
    setTransactionsList(txs);
  };

  const openPushOrderModal = () => {
    setPushOrderForm({
      phone: usersList.find((u) => u.role !== 'admin')?.phone || '',
      items: [{ amount: '', productId: '', quantity: 1 }],
    });
    setPushOrderModal(true);
  };

  const addPushOrderLine = () => {
    setPushOrderForm((f) => ({
      ...f,
      items: [...f.items, { amount: '', productId: '', quantity: 1 }],
    }));
  };

  const removePushOrderLine = (index) => {
    setPushOrderForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items,
    }));
  };

  const updatePushOrderLine = (index, field, value) => {
    setPushOrderForm((f) => ({
      ...f,
      items: f.items.map((line, i) => (i === index ? { ...line, [field]: value } : line)),
    }));
  };

  const handlePushOrderSubmit = async (e) => {
    e.preventDefault();
    if (!pushOrderForm.phone) {
      addToast('danger', 'Lỗi', 'Vui lòng chọn khách hàng.');
      return;
    }
    const items = pushOrderForm.items
      .filter((line) => line.productId)
      .map((line) => ({
        productId: Number(line.productId),
        quantity: Math.max(1, Number(line.quantity) || 1),
      }));
    if (items.length === 0) {
      addToast('danger', 'Lỗi', 'Nhập số tiền, chọn sản phẩm gợi ý rồi đẩy đơn.');
      return;
    }
    try {
      const result = await api.pushOrder({
        phone: pushOrderForm.phone,
        items,
      });
      await refreshOrders();
      setPushOrderModal(false);
      addToast(
        'success',
        'Đẩy đơn',
        result.message || `Đã gửi đơn ${result.order?.order_code || ''} — khách thấy tại Cửa hàng, chưa trừ ví.`
      );
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const openOrderEditModal = (order) => {
    setOrderEditForm({
      status: order.status,
      statusNote: order.status_note || '',
      note: order.note || '',
    });
    setOrderEditModal({ isOpen: true, order });
  };

  const handleOrderEditSubmit = async (e) => {
    e.preventDefault();
    const order = orderEditModal.order;
    if (!order) return;
    try {
      await api.updateOrder(order.id, {
        status: orderEditForm.status,
        statusNote: orderEditForm.statusNote,
        note: orderEditForm.note,
      });
      await refreshOrders();
      setOrderEditModal({ isOpen: false, order: null });
      addToast('success', 'Cập nhật', 'Đã cập nhật trạng thái đơn hàng.');
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const formatTxType = (type) => {
    if (type === 'deposit') return 'Nạp tiền';
    if (type === 'withdraw') return 'Rút tiền';
    if (type === 'purchase') return 'Mua hàng';
    if (type === 'order_refund') return 'Hoàn tiền gốc';
    if (type === 'commission') return 'Hoa hồng đơn';
    return type;
  };
  const formatTxStatus = (status) => {
    if (status === 'pending') return 'Chờ duyệt';
    if (status === 'rejected') return 'Từ chối';
    return 'Hoàn tất';
  };

  const handleApproveOrder = async (orderId) => {
    try {
      await api.approveOrder(orderId);
      await refreshOrders();
      await refreshTransactions();
      addToast('success', 'Duyệt đơn', 'Đã duyệt — hoàn tiền gốc + hoa hồng vào ví khách.');
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const handleRejectOrder = async (orderId) => {
    if (!window.confirm('Từ chối đơn này? Chỉ hoàn tiền gốc, không có hoa hồng.')) return;
    try {
      await api.rejectOrder(orderId);
      await refreshOrders();
      await refreshTransactions();
      addToast('success', 'Từ chối', 'Đã từ chối — chỉ hoàn tiền gốc vào ví khách.');
    } catch (err) {
      addToast('danger', 'Lỗi', err.message);
    }
  };

  const formatPriceVND = (price) => {
    return price.toLocaleString('vi-VN') + ' đ';
  };

  // -------------------------------------------------------------
  // RENDER DYNAMIC SUB-VIEWS
  // -------------------------------------------------------------
  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.phone.includes(searchUser)
  );

  const filteredCategories = categoriesList.filter((c) =>
    c.name.toLowerCase().includes(searchCategory.toLowerCase())
  );

  const filteredProducts = productsList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchProduct.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchProduct.toLowerCase());
    const matchesCategory = selectedAdminProductCategory === 'Tất cả' || p.category === selectedAdminProductCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredOrders = ordersList.filter((o) => {
    const q = searchOrder.toLowerCase();
    return (
      o.order_code?.toLowerCase().includes(q) ||
      o.phone?.includes(searchOrder) ||
      o.user_name?.toLowerCase().includes(q) ||
      getOrderStatusLabel(o.status).toLowerCase().includes(q)
    );
  });

  const filteredTransactions = transactionsList.filter((t) => {
    const q = searchTransaction.toLowerCase();
    return (
      t.phone?.includes(searchTransaction) ||
      t.user_name?.toLowerCase().includes(q) ||
      formatTxType(t.type).toLowerCase().includes(q) ||
      (t.note || '').toLowerCase().includes(q)
    );
  });

  const customerOptions = usersList.filter((u) => u.role !== 'admin');

  const ITEMS_PER_PAGE = 30;

  const paginatedUsers = filteredUsers.slice((userPage - 1) * ITEMS_PER_PAGE, userPage * ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice((orderPage - 1) * ITEMS_PER_PAGE, orderPage * ITEMS_PER_PAGE);
  const paginatedTxs = filteredTransactions.slice((txPage - 1) * ITEMS_PER_PAGE, txPage * ITEMS_PER_PAGE);

  const totalUserPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const totalOrderPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const totalTxPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

  const renderPagination = (currentPage, totalPages, onPageChange) => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="pagination-container">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="pagination-btn"
          aria-label="Trang trước"
        >
          ‹
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="pagination-btn"
            >
              1
            </button>
            {startPage > 2 && <span className="pagination-ellipsis">...</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            className={`pagination-btn ${p === currentPage ? 'active' : ''}`}
          >
            {p}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="pagination-ellipsis">...</span>}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="pagination-btn"
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="pagination-btn"
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="admin-content-grid admin-overview-grid" id="admin-overview-tab">
            <div className="admin-overview-settings-col">
              <div className="admin-settings-card glass-panel" id="admin-store-name-panel">
                <h3>Tên thương hiệu cửa hàng</h3>
                <form onSubmit={handleUpdateStoreName} className="auth-form" id="store-name-update-form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="store-name-input">Tên hiển thị toàn hệ thống</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🏪</span>
                      <input
                        type="text"
                        id="store-name-input"
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        placeholder="VD: Miinto"
                        maxLength={50}
                        value={newStoreName}
                        onChange={(e) => setNewStoreName(e.target.value)}
                      />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                      Áp dụng header, đăng nhập, footer, CSKH. Hiện tại: <strong>{storeName}</strong>
                    </p>
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%' }} id="btn-save-store-name">
                    Lưu tên cửa hàng
                  </button>
                </form>
              </div>

              <div className="admin-settings-card glass-panel" id="admin-settings-panel">
              <h3>Cấu hình Mã Bảo Lãnh</h3>
              <form onSubmit={handleUpdateSponsorCode} className="auth-form" id="sponsor-update-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="new-sponsor-input">Mã bảo lãnh đăng ký mới</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔑</span>
                    <input
                      type="text"
                      id="new-sponsor-input"
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      placeholder="Nhập mã bảo lãnh mới"
                      value={newSponsorCode}
                      onChange={(e) => setNewSponsorCode(e.target.value)}
                    />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                    Thay đổi mã này sẽ yêu cầu các tài khoản đăng ký mới phải nhập đúng mã mới thì mới tạo được tài khoản.
                  </p>
                </div>
                
                <button type="submit" className="btn-primary" style={{ width: '100%' }} id="btn-save-sponsor">
                  Lưu cấu hình mã
                </button>
              </form>
              </div>

              <div className="admin-settings-card glass-panel" id="admin-cskh-settings-panel">
                <h3>Cấu hình Kênh Chat CSKH</h3>
                <form onSubmit={handleUpdateCSKHSettings} className="auth-form" id="cskh-settings-form">
                  <div className="form-group">
                    <label className="form-label" htmlFor="cskh-type-select">Kênh hỗ trợ hoạt động</label>
                    <div className="input-wrapper">
                      <span className="input-icon">💬</span>
                      <select
                        id="cskh-type-select"
                        className="form-input"
                        style={{ paddingLeft: '40px', appearance: 'auto', background: '#ffffff', color: '#333333' }}
                        value={cskhType}
                        onChange={(e) => setCskhType(e.target.value)}
                      >
                        <option value="built_in">Hệ thống Chat mặc định (Bot ảo)</option>
                        <option value="crisp">Crisp Live Chat</option>
                        <option value="tawk">Tawk.to Chat</option>
                        <option value="zalo">Zalo Chat Widget</option>
                        <option value="custom">Script HTML tùy chỉnh (Khác)</option>
                      </select>
                    </div>
                  </div>

                  {cskhType !== 'built_in' && (
                    <div className="form-group animate-fade-in" style={{ marginTop: '14px' }}>
                      <label className="form-label" htmlFor="cskh-script-input">
                        {cskhType === 'crisp' && 'Crisp Website ID (Mã định danh)'}
                        {cskhType === 'tawk' && 'Đường dẫn nhúng Tawk.to (Direct Chat Link)'}
                        {cskhType === 'zalo' && 'Link Zalo Chat hoặc mã HTML widget'}
                        {cskhType === 'custom' && 'Nhập mã nhúng Script HTML (<script>...</script>)'}
                      </label>
                      <div className="input-wrapper">
                        {cskhType === 'custom' ? (
                          <textarea
                            id="cskh-script-input"
                            className="form-input"
                            style={{ height: '100px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                            placeholder="Ví dụ:&#10;&lt;script src=&quot;https://example.com/chat.js&quot;&gt;&lt;/script&gt;"
                            value={cskhScript}
                            onChange={(e) => setCskhScript(e.target.value)}
                          />
                        ) : (
                          <input
                            type="text"
                            id="cskh-script-input"
                            className="form-input"
                            placeholder={
                              cskhType === 'crisp' 
                                ? 'Ví dụ: 871a23b9-1234-abcd-9876-ef1234567890'
                                : cskhType === 'tawk'
                                ? 'Ví dụ: https://embed.tawk.to/60a3c2b1840b301c9088a1b2/1f61abcde'
                                : 'Ví dụ: https://zalo.me/g/xxxxxx'
                            }
                            value={cskhScript}
                            onChange={(e) => setCskhScript(e.target.value)}
                          />
                        )}
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                        {cskhType === 'crisp' && 'Lấy mã ID trong Crisp Dashboard -> Website Settings -> Setup Instructions.'}
                        {cskhType === 'tawk' && 'Lấy Direct Chat Link trong Tawk.to Dashboard -> Property -> Channels -> Chat Widget.'}
                        {cskhType === 'zalo' && 'Có thể dán Link nhóm Zalo hỗ trợ hoặc mã nhúng Chat Zalo.'}
                        {cskhType === 'custom' && 'Dán toàn bộ mã script nhúng được cung cấp bởi nhà phát triển chat bên thứ ba.'}
                      </p>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ width: '100%', marginTop: '16px' }} 
                    id="btn-save-cskh-settings"
                    disabled={isSavingCSKH}
                  >
                    {isSavingCSKH ? '💾 Đang lưu cấu hình...' : '💾 Lưu cấu hình Chat CSKH'}
                  </button>
                </form>
              </div>
            </div>

            <div className="admin-overview-settings-col">
              <div className="admin-settings-card glass-panel" id="admin-banner-settings-panel">
                <h3>Cấu hình Banner Slideshow</h3>
                
                {/* Current Banners List */}
                <div className="banners-manager-section" style={{ marginBottom: '24px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
                    Danh sách Banner Hiện Tại ({bannersList.length})
                  </label>
                  {bannersList.length === 0 ? (
                    <div style={{ padding: '15px', textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px dashed var(--border-glass)', color: 'var(--text-muted)' }}>
                      Chưa có slide banner nào. Hãy thêm ở dưới.
                    </div>
                  ) : (
                    <div className="banners-list-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '8px', background: 'rgba(0,0,0,0.1)' }}>
                      {bannersList.map((banner, index) => (
                        <div key={banner.id || index} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                          <img 
                            src={banner.imageUrl} 
                            alt={banner.title} 
                            style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', background: 'var(--bg-glass-card)', border: '1px solid var(--border-glass)' }}
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=120&auto=format&fit=crop&q=60';
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {banner.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {banner.subtitle}
                            </div>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteBanner(banner.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)' }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
                          >
                            🗑️ Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Banner Form */}
                <form onSubmit={handleAddBanner} className="auth-form" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Thêm Slide Mới</h4>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Tiêu đề Slide</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                      placeholder="VD: Chào mừng đến Miinto"
                      value={newBannerTitle}
                      onChange={(e) => setNewBannerTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Mô tả ngắn</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.85rem', padding: '8px 12px' }}
                      placeholder="VD: Mua sắm tiện lợi, giao hàng nhanh chóng."
                      value={newBannerSubtitle}
                      onChange={(e) => setNewBannerSubtitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Hình ảnh Banner</label>
                    
                    {/* File Upload Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-glass)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)', transition: 'background 0.2s' }}>
                        📁 Chọn tập tin ảnh
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleBannerUpload}
                          disabled={isUploading}
                        />
                      </label>
                      {isUploading && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏳ Đang tải ảnh lên...</span>}
                    </div>

                    {/* Image URL Input */}
                    <div className="input-wrapper">
                      <span className="input-icon" style={{ fontSize: '0.8rem' }}>🔗</span>
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '32px', fontSize: '0.85rem', padding: '8px 12px 8px 32px' }}
                        placeholder="Hoặc dán URL hình ảnh tại đây..."
                        value={newBannerImage}
                        onChange={(e) => setNewBannerImage(e.target.value)}
                      />
                    </div>
                  </div>

                  {newBannerImage && (
                    <div style={{ marginTop: '4px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', textAlign: 'left' }}>Xem trước ảnh:</span>
                      <img 
                        src={newBannerImage} 
                        alt="Xem trước" 
                        style={{ maxWidth: '100%', maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }} 
                      />
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)', padding: '8px', fontSize: '0.85rem', marginTop: '4px' }}
                  >
                    ➕ Thêm Vào Slide Tạm Thời
                  </button>
                </form>

                {/* Save Banners to System */}
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', fontWeight: 600, fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                    onClick={handleSaveBanners}
                    disabled={isSavingBanners}
                  >
                    {isSavingBanners ? '💾 Đang lưu cấu hình...' : '💾 Lưu cấu hình Slide Banner'}
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', lineHeight: '1.4' }}>
                    * Lưu ý: Phải bấm <strong>Lưu cấu hình Slide Banner</strong> thì thay đổi mới có hiệu lực toàn hệ thống.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'members':
        return (
          <div className="admin-table-card glass-panel" id="admin-members-tab">
            <div className="admin-card-header-flex">
              <h3>Thành viên Hệ thống</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '220px', padding: '8px 12px' }}
                  placeholder="Tìm thành viên, SĐT..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  id="search-user-input"
                />
                <button className="btn-add" onClick={() => openMemberModal('add')} id="btn-add-member-trigger">
                  <span>+</span> Thêm Thành Viên
                </button>
              </div>
            </div>

            <div className="table-wrapper" id="users-table-wrapper">
              {filteredUsers.length > 0 ? (
                <table className="admin-table" id="users-table">
                  <thead>
                    <tr>
                      <th>Họ và Tên</th>
                      <th>Số Điện Thoại</th>
                      <th>Số dư ví</th>
                      <th>Vai Trò</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user, idx) => (
                      <tr key={idx} id={`member-row-${idx}`}>
                        <td className="user-name-cell">
                          <div className="avatar-placeholder">
                            {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500 }} id={`member-name-${idx}`}>
                              {user.name}
                              {user.is_frozen && (
                                <span className="user-badge" style={{ marginLeft: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.7rem', padding: '2px 6px' }}>
                                  ❄️ Đã đóng băng
                                </span>
                              )}
                            </span>
                            {user.role !== 'admin' && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Quyền mua: {user.allowed_categories || 'Mỹ Phẩm 10%'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td id={`member-phone-${idx}`}>{user.phone}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }} id={`member-balance-${idx}`}>
                          {formatPriceVND(user.balance || 0)}
                        </td>
                        <td>
                          <span className={`user-badge ${user.role}`} id={`member-role-${idx}`}>
                            {user.role === 'admin' ? 'Quản trị' : 'Thành viên'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn-action edit" onClick={() => openMemberModal('edit', user)} id={`btn-edit-member-${idx}`}>Sửa</button>
                            <button className="btn-action delete" onClick={() => handleMemberDelete(user.phone, user.name)} id={`btn-delete-member-${idx}`}>Xóa</button>
                            {user.role !== 'admin' && (
                              <>
                                <button 
                                  className={`btn-action ${user.is_frozen ? 'unfreeze' : 'freeze'}`}
                                  style={{
                                    background: user.is_frozen ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    color: user.is_frozen ? '#22c55e' : '#ef4444',
                                    border: user.is_frozen ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                                  }}
                                  onClick={() => handleToggleFreeze(user)}
                                  id={`btn-freeze-member-${idx}`}
                                >
                                  {user.is_frozen ? '🔥 Mở băng' : '❄️ Đóng băng'}
                                </button>
                                <button 
                                  className="btn-action edit"
                                  style={{
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    color: '#f59e0b',
                                    border: '1px solid rgba(245, 158, 11, 0.2)',
                                  }}
                                  onClick={() => openPermissionsModal(user)}
                                  id={`btn-perms-member-${idx}`}
                                >
                                  🔑 Quyền
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }} id="no-members-found">
                  👥 Chưa tìm thấy thành viên nào phù hợp.
                </div>
              )}
              {renderPagination(userPage, totalUserPages, setUserPage)}
            </div>
          </div>
        );

      case 'categories':
        return (
          <div className="admin-table-card glass-panel" id="admin-categories-tab">
            <div className="admin-card-header-flex">
              <h3>Danh mục Hàng hóa</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '220px', padding: '8px 12px' }}
                  placeholder="Tìm danh mục..."
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                  id="search-category-input"
                />
                <button className="btn-add" onClick={() => openCategoryModal('add')} id="btn-add-cat-trigger">
                  <span>+</span> Thêm Danh Mục
                </button>
              </div>
            </div>

            <div className="table-wrapper" id="categories-table-wrapper">
              {filteredCategories.length > 0 ? (
                <table className="admin-table" id="categories-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>STT</th>
                      <th style={{ width: '72px' }}>Ảnh</th>
                      <th>Tên Danh Mục</th>
                      <th style={{ textAlign: 'center', width: '200px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCategories.map((cat, idx) => (
                      <tr key={cat.name} id={`cat-row-${idx}`}>
                        <td style={{ fontWeight: 600 }}>{idx + 1}</td>
                        <td>
                          {cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('data:')) ? (
                            <img
                              src={cat.icon}
                              alt={cat.name}
                              style={{
                                width: 44,
                                height: 44,
                                objectFit: 'cover',
                                borderRadius: 6,
                                border: '1px solid var(--border-glass)',
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '1.5rem' }}>🏷️</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 500 }} id={`cat-name-${idx}`}>{cat.name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn-action edit" onClick={() => openCategoryModal('edit', cat)} id={`btn-edit-cat-${idx}`}>Sửa</button>
                            <button className="btn-action delete" onClick={() => handleCategoryDelete(cat.name)} id={`btn-delete-cat-${idx}`}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }} id="no-cats-found">
                  🏷️ Chưa có danh mục hàng hóa phù hợp.
                </div>
              )}
            </div>
          </div>
        );

      case 'transactions':
        return (
          <div className="admin-table-card glass-panel" id="admin-transactions-tab">
            {pendingWithdrawals.length > 0 && (
              <div className="admin-pending-withdrawals" id="admin-pending-withdrawals" style={{ marginBottom: '28px' }}>
                <h4>Yêu cầu rút tiền chờ duyệt ({pendingWithdrawals.length})</h4>
                <div className="admin-pending-list">
                  {pendingWithdrawals.map((tx) => (
                    <div key={tx.id} className="admin-pending-item">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        <div><strong>Họ tên:</strong> {tx.account_holder} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({tx.user_name} — {tx.phone})</span></div>
                        <div><strong>Ngân Hàng:</strong> {tx.bank_name}</div>
                        <div><strong>Số TK:</strong> {tx.account_number}</div>
                        <div><strong>Số Tiền:</strong> <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{formatPriceVND(tx.amount)}</span></div>
                      </div>
                      <div className="admin-pending-actions">
                        <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleApproveWithdraw(tx.id)}>
                          Duyệt
                        </button>
                        <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleRejectWithdraw(tx.id)}>
                          Từ chối
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="admin-card-header-flex">
              <h3>Lịch sử Giao dịch Ví</h3>
              <input
                type="text"
                className="form-input"
                style={{ width: '260px', padding: '8px 12px' }}
                placeholder="Tìm SĐT, tên, loại giao dịch..."
                value={searchTransaction}
                onChange={(e) => setSearchTransaction(e.target.value)}
              />
            </div>
            <div className="table-wrapper">
              {filteredTransactions.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Khách hàng</th>
                      <th>Loại</th>
                      <th>Số tiền</th>
                      <th>Trạng thái</th>
                      <th>Ghi chú / Ngân hàng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTxs.map((tx) => (
                      <tr key={tx.id}>
                        <td style={{ fontSize: '0.85rem' }}>{formatDateTime(tx.created_at)}</td>
                        <td>
                          <strong>{tx.user_name}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.phone}</div>
                        </td>
                        <td>
                          <span className={`tx-badge ${tx.type}`}>
                            {formatTxType(tx.type)}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: tx.type === 'deposit' || tx.type === 'order_refund' || tx.type === 'commission' ? 'var(--success)' : 'var(--primary)' }}>
                          {tx.type === 'withdraw' || tx.type === 'purchase' ? '−' : '+'}
                          {formatPriceVND(tx.amount)}
                        </td>
                        <td>
                          <span className={`tx-status-badge ${tx.status}`}>
                            {formatTxStatus(tx.status)}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', maxWidth: '280px' }}>
                          {tx.type === 'withdraw' && tx.bank_name ? (
                            <span>
                              {tx.bank_name} · {tx.account_number} · {tx.account_holder}
                            </span>
                          ) : (
                            tx.note || '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  💳 Chưa có giao dịch nào phù hợp.
                </div>
              )}
              {renderPagination(txPage, totalTxPages, setTxPage)}
            </div>
          </div>
        );

      case 'orders':
        return (
          <div className="admin-table-card glass-panel" id="admin-orders-tab">
            <div className="admin-card-header-flex">
              <h3>Đơn hàng Hệ thống</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '220px', padding: '8px 12px' }}
                  placeholder="Mã đơn, SĐT, tên..."
                  value={searchOrder}
                  onChange={(e) => setSearchOrder(e.target.value)}
                />
                <button type="button" className="btn-add" onClick={openPushOrderModal}>
                  <span>+</span> Đẩy đơn cho khách
                </button>
              </div>
            </div>
            <div className="table-wrapper">
              {filteredOrders.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Sản phẩm</th>
                      <th>Tiền gốc / Hoa hồng</th>
                      <th>Trạng thái</th>
                      <th>Thời gian</th>
                      <th style={{ textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order) => (
                      <tr key={order.id}>
                        <td style={{ fontWeight: 700 }}>{order.order_code}</td>
                        <td>
                          <strong>{order.user_name}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.phone}</div>
                        </td>
                        <td style={{ fontSize: '0.85rem', maxWidth: '220px' }}>
                          {(order.items || []).map((item) => (
                            <div key={item.id}>
                              {item.quantity}x {item.product_name}
                            </div>
                          ))}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatPriceVND(order.principal_amount ?? order.total_amount)}</div>
                          {order.commission_percent > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                              HH {order.commission_percent}%: {formatPriceVND(order.commission_amount)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`user-badge ${getOrderStatusBadgeClass(order.status)}`} style={{ fontSize: '0.75rem' }}>
                            {getOrderStatusLabel(order.status)}
                          </span>
                          {order.created_by === 'customer' && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Mua từ khách</div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{formatDateTime(order.created_at)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {order.status === 'offered' ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chờ khách mua tại Cửa hàng</span>
                          ) : order.status === 'pending' && order.created_by === 'customer' ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button type="button" className="btn-primary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleApproveOrder(order.id)}>
                                Duyệt
                              </button>
                              <button type="button" className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleRejectOrder(order.id)}>
                                Từ chối
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="btn-action edit" onClick={() => openOrderEditModal(order)}>
                              Sửa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  🚚 Chưa có đơn hàng. Bấm &quot;Đẩy đơn cho khách&quot; để tạo đơn mới.
                </div>
              )}
              {renderPagination(orderPage, totalOrderPages, setOrderPage)}
            </div>
          </div>
        );

      case 'products':
        return (
          <div className="admin-table-card glass-panel" id="admin-products-tab">
            <div className="admin-card-header-flex">
              <h3>Kệ hàng Sản phẩm</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '220px', padding: '8px 12px' }}
                  placeholder="Tìm sản phẩm, nhóm..."
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  id="search-prod-input"
                />
                <button className="btn-add" onClick={() => openProductModal('add')} id="btn-add-prod-trigger">
                  <span>+</span> Thêm Sản Phẩm
                </button>
              </div>
            </div>

            {/* Thanh chọn danh mục sản phẩm cho Admin */}
            <div className="admin-prod-cat-tabs" style={{
              display: 'flex',
              gap: '8px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-glass)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              background: 'rgba(255, 255, 255, 0.02)',
              marginBottom: '10px'
            }}>
              {['Tất cả', ...categoriesList.map(c => c.name)].map((catName) => (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setSelectedAdminProductCategory(catName)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: selectedAdminProductCategory === catName ? 'var(--primary)' : 'var(--border-glass)',
                    background: selectedAdminProductCategory === catName ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                    color: selectedAdminProductCategory === catName ? '#ffffff' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: selectedAdminProductCategory === catName ? '0 4px 10px rgba(238, 77, 45, 0.2)' : 'none'
                  }}
                >
                  {catName}
                </button>
              ))}
            </div>

            <div className="table-wrapper" id="products-table-wrapper">
              {filteredProducts.length > 0 ? (
                <table className="admin-table" id="products-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>Icon</th>
                      <th>Tên Sản phẩm</th>
                      <th>Nhóm Danh mục</th>
                      <th>Giá Niêm Yết</th>
                      <th style={{ textAlign: 'center', width: '200px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((prod, idx) => (
                      <tr key={prod.id} id={`prod-row-${idx}`}>
                        <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          {prod.icon && (prod.icon.startsWith('http') || prod.icon.startsWith('data:') || prod.icon.startsWith('/')) ? (
                            <img 
                              src={prod.icon} 
                              alt={prod.name} 
                              style={{ 
                                width: '36px', 
                                height: '36px', 
                                objectFit: 'cover', 
                                borderRadius: '6px',
                                border: '1px solid var(--border-glass)',
                                display: 'inline-block'
                              }} 
                            />
                          ) : (
                            <span style={{ fontSize: '1.4rem' }}>{prod.icon || '📦'}</span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }} id={`prod-name-${idx}`}>{prod.name}</td>
                        <td>
                          <span className="user-badge" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)', border: '1px solid var(--border-glass)' }} id={`prod-cat-${idx}`}>
                            {prod.category}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }} id={`prod-price-${idx}`}>{formatPriceVND(prod.price)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button className="btn-action edit" onClick={() => openProductModal('edit', prod)} id={`btn-edit-prod-${idx}`}>Sửa</button>
                            <button className="btn-action delete" onClick={() => handleProductDelete(prod.id, prod.name)} id={`btn-delete-prod-${idx}`}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }} id="no-prods-found">
                  📦 Kệ hàng chưa có sản phẩm nào khớp.
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const pendingOrdersCount = ordersList.filter((o) => o.status === 'pending').length;
  const pendingWithdrawalsCount = pendingWithdrawals.length;

  return (
    <div className="admin-wrapper animate-fade-in" id="admin-view">
      {/* Tab Header Stats block */}
      <div className="admin-header" id="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="admin-title">
          <h1 id="admin-title-h1">HỆ THỐNG QUẢN TRỊ</h1>
          <p id="admin-subtitle">Bảng quản trị hệ thống {storeName}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => handleRefreshSystemData(false)}
            disabled={isRefreshing || isWiping}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--primary)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(238, 77, 45, 0.2)',
              transition: 'all 0.2s ease',
            }}
            id="btn-refresh-system-data"
          >
            {isRefreshing ? '🔄 Đang làm mới...' : '🔄 Làm mới dữ liệu'}
          </button>

          <button
            onClick={handleWipeSystemData}
            disabled={isRefreshing || isWiping}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
              transition: 'all 0.2s ease',
            }}
            id="btn-wipe-system-data"
          >
            {isWiping ? '🗑️ Đang xóa...' : '🗑️ Xóa dữ liệu'}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="stats-grid" id="admin-stats-grid">
        <div className="stat-card glass-panel" id="stat-card-users" onClick={() => setActiveTab('members')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper green">👥</div>
          <div className="stat-info">
            <span className="stat-label">Tổng số Thành viên</span>
            <span className="stat-value" id="stat-val-users">{usersList.length}</span>
          </div>
        </div>

        <div className="stat-card glass-panel" id="stat-card-sponsor" onClick={() => setActiveTab('overview')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper gold">🔑</div>
          <div className="stat-info">
            <span className="stat-label">Mã Bảo Lãnh Mới Nhất</span>
            <span className="stat-value" style={{ color: 'var(--primary)' }} id="stat-val-sponsor">{sponsorCode}</span>
          </div>
        </div>

        <div className="stat-card glass-panel" id="stat-card-products" onClick={() => setActiveTab('products')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon-wrapper green" style={{ color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.2)', background: 'rgba(129, 140, 248, 0.1)' }}>
            📦
          </div>
          <div className="stat-info">
            <span className="stat-label">Sản phẩm kích hoạt</span>
            <span className="stat-value" id="stat-val-products">{productsList.length}</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation buttons bar */}
      <div className="admin-tab-group" id="admin-tabs">
        <button className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} id="tab-btn-overview">
          ⚙️ Cấu hình chung
        </button>
        <button className={`admin-tab-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')} id="tab-btn-members">
          👥 Quản lý thành viên
        </button>
        <button className={`admin-tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')} id="tab-btn-categories">
          🏷️ Quản lý danh mục
        </button>
        <button className={`admin-tab-btn ${activeTab === 'products' ? 'active' : ''}`} onClick={() => setActiveTab('products')} id="tab-btn-products">
          📦 Quản lý sản phẩm
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
          id="tab-btn-transactions"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          💳 Quản lý giao dịch
          {pendingWithdrawalsCount > 0 && (
            <span style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              fontWeight: '700',
              marginLeft: '4px',
              lineHeight: '1'
            }}>
              {pendingWithdrawalsCount}
            </span>
          )}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
          id="tab-btn-orders"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          🚚 Quản lý đơn hàng
          {pendingOrdersCount > 0 && (
            <span style={{
              backgroundColor: '#ef4444',
              color: '#ffffff',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '0.7rem',
              fontWeight: '700',
              marginLeft: '4px',
              lineHeight: '1'
            }}>
              {pendingOrdersCount}
            </span>
          )}
        </button>
      </div>

      {/* Render active sub-view content */}
      {renderActiveTab()}

      {/* -------------------------------------------------------------
          MEMBER ADD / EDIT MODAL
          ------------------------------------------------------------- */}
      {pushOrderModal && (
        <div className="modal-backdrop" id="push-order-modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Đẩy đơn cho khách hàng</span>
              <button type="button" className="modal-close" onClick={() => setPushOrderModal(false)}>&times;</button>
            </div>
            <form onSubmit={handlePushOrderSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Khách hàng</label>
                <select
                  className="form-input"
                  value={pushOrderForm.phone}
                  onChange={(e) => setPushOrderForm({ ...pushOrderForm, phone: e.target.value })}
                  required
                >
                  <option value="">— Chọn khách —</option>
                  {customerOptions.map((u) => (
                    <option key={u.phone} value={u.phone}>
                      {u.name} — {u.phone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sản phẩm (nhập số tiền để gợi ý)</label>
                {pushOrderForm.items.map((line, idx) => {
                  const suggestions = getProductsNearPrice(productsList, line.amount);
                  return (
                    <div key={idx} className="push-order-line" style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-glass)' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          style={{ flex: 1, minWidth: '140px', padding: '10px 12px !important' }}
                          placeholder="Nhập số tiền (VD: 100000)"
                          value={line.amount}
                          onChange={(e) => updatePushOrderLine(idx, 'amount', e.target.value)}
                        />
                        <input
                          type="number"
                          min={1}
                          className="form-input form-input-qty"
                          value={line.quantity}
                          onChange={(e) => updatePushOrderLine(idx, 'quantity', e.target.value)}
                          aria-label="Số lượng"
                        />
                        {pushOrderForm.items.length > 1 && (
                          <button type="button" className="btn-secondary" style={{ padding: '6px 10px' }} onClick={() => removePushOrderLine(idx)}>
                            ×
                          </button>
                        )}
                      </div>
                      {line.amount && (
                        <div className="push-order-suggestions">
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 6px' }}>
                            Sản phẩm gần với {formatPriceVND(Number(String(line.amount).replace(/\D/g, '')) || 0)}:
                          </p>
                          {suggestions.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Không có sản phẩm phù hợp.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {suggestions.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={`push-order-pick ${String(line.productId) === String(p.id) ? 'active' : ''}`}
                                  onClick={() => updatePushOrderLine(idx, 'productId', String(p.id))}
                                  style={{
                                    textAlign: 'left',
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    border: String(line.productId) === String(p.id) ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                                    background: String(line.productId) === String(p.id) ? 'rgba(238, 77, 45, 0.08)' : '#fff',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                  }}
                                >
                                  <strong>{p.name}</strong>
                                  <span style={{ color: 'var(--primary)', marginLeft: '8px' }}>{formatPriceVND(p.price)}</span>
                                  <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '0.75rem' }}>
                                    (chênh {formatPriceVND(p.priceDiff)})
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" className="btn-secondary" style={{ fontSize: '0.85rem' }} onClick={addPushOrderLine}>
                  + Thêm dòng sản phẩm
                </button>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setPushOrderModal(false)}>Hủy</button>
                <button type="submit" className="btn-primary">Đẩy đơn</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {orderEditModal.isOpen && orderEditModal.order && (
        <div className="modal-backdrop" id="order-edit-modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <span className="modal-title">Sửa đơn {orderEditModal.order.order_code}</span>
              <button type="button" className="modal-close" onClick={() => setOrderEditModal({ isOpen: false, order: null })}>&times;</button>
            </div>
            <form onSubmit={handleOrderEditSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Trạng thái</label>
                <select
                  className="form-input"
                  value={orderEditForm.status}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, status: e.target.value })}
                >
                  {ORDER_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Ghi chú trạng thái</label>
                <input
                  type="text"
                  className="form-input"
                  value={orderEditForm.statusNote}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, statusNote: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setOrderEditModal({ isOpen: false, order: null })}>Hủy</button>
                <button type="submit" className="btn-primary">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {memberModal.isOpen && (
        <div className="modal-backdrop" id="member-modal-backdrop">
          <div className="modal-content glass-panel" id="member-modal-content">
            <div className="modal-header">
              <span className="modal-title" id="member-modal-title">
                {memberModal.type === 'add' ? 'Thêm cộng tác viên mới' : 'Chỉnh sửa tài khoản CTV'}
              </span>
              <button className="modal-close" onClick={closeMemberModal} id="btn-close-member-modal">&times;</button>
            </div>
            <form onSubmit={handleMemberSubmit} className="auth-form" id="member-modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="m-name">Họ và tên</label>
                <div className="input-wrapper">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    id="m-name"
                    className="form-input"
                    style={{ paddingLeft: '40px' }}
                    placeholder="Nguyễn Văn A"
                    value={memberForm.name}
                    onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-phone">Số điện thoại</label>
                <div className="input-wrapper">
                  <span className="input-icon">📞</span>
                  <input
                    type="tel"
                    id="m-phone"
                    className="form-input"
                    style={{ paddingLeft: '40px' }}
                    placeholder="09xxxxxxxx"
                    value={memberForm.phone}
                    onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-pass">Mật khẩu {memberModal.type === 'edit' && '(Để trống nếu giữ nguyên)'}</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    id="m-pass"
                    className="form-input"
                    style={{ paddingLeft: '40px' }}
                    placeholder="••••••••"
                    value={memberForm.password}
                    onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="m-role">Quyền hệ thống</label>
                <div className="input-wrapper">
                  <select
                    id="m-role"
                    className="form-input"
                    style={{ paddingLeft: '16px', background: '#ffffff' }}
                    value={memberForm.role}
                    onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                  >
                    <option value="user">Thành viên (Cộng tác viên)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>
              </div>

              {memberModal.type === 'edit' && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="m-balance">Số dư ví (Admin chỉnh)</label>
                    <div className="input-wrapper">
                      <span className="input-icon">💳</span>
                      <input
                        type="number"
                        id="m-balance"
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        min="0"
                        value={memberForm.balance}
                        onChange={(e) => setMemberForm({ ...memberForm, balance: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group admin-deposit-inline">
                    <label className="form-label" htmlFor="m-deposit">Nạp tiền cho thành viên</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="number"
                        id="m-deposit"
                        className="form-input"
                        min="1000"
                        placeholder="Số tiền nạp"
                        value={adminDepositAmount}
                        onChange={(e) => setAdminDepositAmount(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="btn-primary" onClick={handleAdminDeposit} style={{ whiteSpace: 'nowrap' }}>
                        Xác nhận nạp
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeMemberModal} id="btn-cancel-member-modal">Hủy</button>
                <button type="submit" className="btn-primary" id="btn-save-member-modal">Lưu cấu hình</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          CATEGORY ADD / EDIT MODAL
          ------------------------------------------------------------- */}
      {categoryModal.isOpen && (
        <div className="modal-backdrop" id="cat-modal-backdrop">
          <div className="modal-content glass-panel" id="cat-modal-content">
            <div className="modal-header">
              <span className="modal-title" id="cat-modal-title">
                {categoryModal.type === 'add' ? 'Tạo danh mục mới' : 'Chỉnh sửa danh mục'}
              </span>
              <button className="modal-close" onClick={closeCategoryModal} id="btn-close-cat-modal">&times;</button>
            </div>
            <form onSubmit={handleCategorySubmit} className="auth-form" id="cat-modal-form">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="cat-name-input">Tên danh mục</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🏷️</span>
                    <input
                      type="text"
                      id="cat-name-input"
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      placeholder="Mỹ Phẩm, Điện Tử..."
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="cat-percent-input">Phần trăm (%)</label>
                  <div className="input-wrapper">
                    <span className="input-icon">📊</span>
                    <input
                      type="number"
                      id="cat-percent-input"
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      placeholder="10"
                      min="0"
                      max="100"
                      value={categoryForm.percent}
                      onChange={(e) => setCategoryForm({ ...categoryForm, percent: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cat-icon">Hình ảnh danh mục</label>
                <div className="input-wrapper" style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <span className="input-icon" style={{ zIndex: 10 }}>🖼️</span>
                    <input
                      type="text"
                      id="cat-icon"
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      placeholder="Link ảnh hoặc tải lên R2"
                      value={categoryForm.icon}
                      onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    />
                  </div>
                  <label
                    className="btn-primary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: '0 16px',
                      fontSize: '0.9rem',
                      margin: 0,
                      whiteSpace: 'nowrap',
                      minHeight: '42px',
                      borderRadius: '8px',
                    }}
                  >
                    📁 {isUploading ? 'Đang tải...' : 'Tải ảnh'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleCategoryImageUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>

              {categoryForm.icon &&
                (categoryForm.icon.startsWith('http') || categoryForm.icon.startsWith('data:image')) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Xem trước:</span>
                    <img
                      src={categoryForm.icon}
                      alt="Preview"
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--border-glass)',
                      }}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: 'auto' }}
                      onClick={() => setCategoryForm({ ...categoryForm, icon: '' })}
                    >
                      Xóa ảnh
                    </button>
                  </div>
                )}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeCategoryModal} id="btn-cancel-cat-modal">Hủy</button>
                <button type="submit" className="btn-primary" id="btn-save-cat-modal">Lưu danh mục</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          PRODUCT ADD / EDIT MODAL
          ------------------------------------------------------------- */}
      {productModal.isOpen && (
        <div className="modal-backdrop" id="prod-modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px' }} id="prod-modal-content">
            <div className="modal-header">
              <span className="modal-title" id="prod-modal-title">
                {productModal.type === 'add' ? 'Thêm sản phẩm mới lên kệ' : 'Cập nhật sản phẩm'}
              </span>
              <button className="modal-close" onClick={closeProductModal} id="btn-close-prod-modal">&times;</button>
            </div>
            <form onSubmit={handleProductSubmit} className="auth-form" id="prod-modal-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="p-name">Tên sản phẩm</label>
                  <div className="input-wrapper">
                    <span className="input-icon">📦</span>
                    <input
                      type="text"
                      id="p-name"
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      placeholder="Royal Oak..."
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="p-price">Giá niêm yết (VNĐ)</label>
                  <div className="input-wrapper">
                    <span className="input-icon">💵</span>
                    <input
                      type="number"
                      id="p-price"
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                      placeholder="Ví dụ: 4500000"
                      value={productForm.price}
                      onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="p-cat">Nhóm danh mục</label>
                  <div className="input-wrapper">
                    <select
                      id="p-cat"
                      className="form-input"
                      style={{ paddingLeft: '16px', background: '#ffffff' }}
                      value={productForm.category}
                      onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    >
                      {categoriesList.map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="p-icon">Hình ảnh / Biểu tượng</label>
                  <div className="input-wrapper" style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span className="input-icon" style={{ zIndex: 10 }}>✨</span>
                      <input
                        type="text"
                        id="p-icon"
                        className="form-input"
                        style={{ paddingLeft: '40px' }}
                        placeholder="Emoji hoặc link ảnh"
                        value={productForm.icon}
                        onChange={(e) => setProductForm({ ...productForm, icon: e.target.value })}
                      />
                    </div>
                    <label 
                      className="btn-primary" 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        cursor: 'pointer',
                        padding: '0 16px',
                        fontSize: '0.9rem',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        minHeight: '42px',
                        borderRadius: '8px'
                      }}
                    >
                      📁 {isUploading ? 'Đang tải...' : 'Tải ảnh'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {productForm.icon && (productForm.icon.startsWith('http') || productForm.icon.startsWith('data:image')) && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Xem trước hình ảnh:</span>
                  <img 
                    src={productForm.icon} 
                    alt="Preview" 
                    style={{ 
                      width: '60px', 
                      height: '60px', 
                      objectFit: 'cover', 
                      borderRadius: '8px', 
                      border: '1px solid var(--border-glass)' 
                    }} 
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.8rem', minHeight: 'auto' }}
                    onClick={() => setProductForm({ ...productForm, icon: '📦' })}
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="p-desc">Mô tả chi tiết sản phẩm</label>
                <div className="input-wrapper">
                  <textarea
                    id="p-desc"
                    className="form-input"
                    style={{ padding: '12px', minHeight: '100px', resize: 'vertical' }}
                    placeholder="Mô tả các thông số kỹ thuật, đặc điểm nổi bật sản phẩm..."
                    value={productForm.desc}
                    onChange={(e) => setProductForm({ ...productForm, desc: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeProductModal} id="btn-cancel-prod-modal">Hủy</button>
                <button type="submit" className="btn-primary" id="btn-save-prod-modal">Lưu sản phẩm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          CATEGORY PERMISSIONS MODAL
          ------------------------------------------------------------- */}
      {permissionsModal.isOpen && permissionsModal.user && (
        <div className="modal-backdrop" id="perms-modal-backdrop">
          <div className="modal-content glass-panel" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Phân Quyền Danh Mục Mua Hàng</span>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setPermissionsModal({ isOpen: false, user: null })}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handlePermissionsSubmit} className="auth-form">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.4' }}>
                Chọn những danh mục khu vực phần trăm mà thành viên <strong>{permissionsModal.user.name}</strong> được phép giao dịch mua hàng:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {(categoriesList.length > 0 ? categoriesList.map(c => c.name) : DEFAULT_CATEGORIES).map((catName) => {
                  const isChecked = allowedCatsForm.includes(catName);
                  return (
                    <label 
                      key={catName} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        padding: '10px 14px', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border-glass)', 
                        background: isChecked ? 'rgba(238, 77, 45, 0.04)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        fontWeight: isChecked ? 600 : 400,
                        color: isChecked ? 'var(--primary)' : 'var(--text-primary)'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={() => toggleCategorySelection(catName)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span>{catName}</span>
                    </label>
                  );
                })}
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setPermissionsModal({ isOpen: false, user: null })}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Lưu cấu hình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
